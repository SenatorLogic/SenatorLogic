#!/bin/bash
# End-to-end smoke test against a running server.
set -uo pipefail
BASE="${BASE:-http://localhost:3311}"
JAR=$(mktemp); ADMIN_JAR=$(mktemp)
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); printf '  ok   %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  FAIL %s  (%s)\n' "$1" "${2:-}"; }
check() { [ "$2" = "$3" ] && ok "$1" || bad "$1" "expected $3, got $2"; }

# Pull the CSRF token out of a rendered form.
csrf() {
  curl -s -b "$1" -c "$1" "$BASE$2" \
    | grep -o 'name="_csrf" value="[a-f0-9]*"' | head -1 \
    | sed 's/.*value="//; s/"//'
}

status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "== Registration =="
T=$(csrf "$ADMIN_JAR" /register)
[ -n "$T" ] && ok "csrf token issued" || bad "csrf token issued"
C=$(curl -s -o /dev/null -w '%{http_code}' -b "$ADMIN_JAR" -c "$ADMIN_JAR" -X POST "$BASE/register" \
  -d "_csrf=$T" -d "full_name=Chidi Okoro" -d "email=chidi@example.com" \
  -d "password=strongpass123" -d "confirm_password=strongpass123")
check "first member registers" "$C" "302"

C=$(status -b "$ADMIN_JAR" "$BASE/admin")
check "first member is an admin" "$C" "200"

echo "== CSRF protection =="
C=$(status -b "$ADMIN_JAR" -X POST "$BASE/profile/edit" -d "full_name=Hacked" -d "_csrf=wrong")
check "POST with a bad token is refused" "$C" "403"

echo "== Duplicate + weak signups =="
T=$(csrf "$JAR" /register)
C=$(status -b "$JAR" -c "$JAR" -X POST "$BASE/register" -d "_csrf=$T" \
  -d "full_name=Someone" -d "email=chidi@example.com" -d "password=strongpass123" -d "confirm_password=strongpass123")
check "duplicate email is rejected" "$C" "400"
T=$(csrf "$JAR" /register)
C=$(status -b "$JAR" -c "$JAR" -X POST "$BASE/register" -d "_csrf=$T" \
  -d "full_name=Someone" -d "email=new@example.com" -d "password=short" -d "confirm_password=short")
check "short password is rejected" "$C" "400"

echo "== Profile =="
T=$(csrf "$ADMIN_JAR" /profile/edit)
C=$(status -b "$ADMIN_JAR" -c "$ADMIN_JAR" -X POST "$BASE/profile/edit" \
  -F "_csrf=$T" -F "full_name=Chidi Okoro" -F "phone=08031234567" -F "gender=Male" \
  -F "occupation=Civil Engineer" -F "address=12 Gwarinpa Estate, Abuja" \
  -F "obowo_address=Umuariam, Obowo LGA, Imo State" -F "relationship_status=Single" \
  -F "birthday=1995-04-18" -F "about=Glad to be here." -F "photo=@public/img/icon-192.png")
check "profile saves with a photo" "$C" "302"
curl -s -b "$ADMIN_JAR" "$BASE/profile" | grep -q "Umuariam" && ok "obowo address shows on profile" || bad "obowo address shows on profile"
curl -s -b "$ADMIN_JAR" "$BASE/profile" | grep -q "18 April" && ok "birthday shows day and month only" || bad "birthday shows day and month only"
curl -s -b "$ADMIN_JAR" "$BASE/profile" | grep -q "1995" && bad "birth year is hidden" || ok "birth year is hidden"

echo "== Photo serving =="
CT=$(curl -s -o /dev/null -w '%{content_type}' -b "$ADMIN_JAR" "$BASE/photo/1")
[ "$CT" = "image/png" ] && ok "photo served as png" || bad "photo served as png" "got $CT"
C=$(status -X POST "$BASE/profile/edit")
check "signed-out POST without a token is refused" "$C" "403"

echo "== Bad uploads =="
echo "not an image" > /tmp/fake.png
T=$(csrf "$ADMIN_JAR" /profile/edit)
C=$(status -b "$ADMIN_JAR" -c "$ADMIN_JAR" -X POST "$BASE/profile/edit" \
  -F "_csrf=$T" -F "full_name=Chidi Okoro" -F "photo=@/tmp/fake.png;type=image/png")
check "a fake image is rejected" "$C" "400"

echo "== Admin: office assignment =="
T=$(csrf "$ADMIN_JAR" /admin/members/1/edit)
C=$(status -b "$ADMIN_JAR" -c "$ADMIN_JAR" -X POST "$BASE/admin/members/1/edit" \
  -F "_csrf=$T" -F "full_name=Chidi Okoro" -F "office=President" -F "is_admin=yes" \
  -F "obowo_address=Umuariam, Obowo LGA, Imo State")
check "admin sets an office" "$C" "302"
curl -s "$BASE/" | grep -q "President" && ok "president shows on the home page" || bad "president shows on the home page"
curl -s "$BASE/" | grep -q "Chidi Okoro" && ok "exco name shows on the home page" || bad "exco name shows on the home page"
CT=$(curl -s -o /dev/null -w '%{content_type}' "$BASE/photo/1")
[ "$CT" = "image/png" ] && ok "exco photo is public" || bad "exco photo is public" "got $CT"

echo "== Second member, edited by the admin =="
T=$(csrf "$JAR" /register)
curl -s -o /dev/null -b "$JAR" -c "$JAR" -X POST "$BASE/register" -d "_csrf=$T" \
  -d "full_name=Ngozi Eze" -d "email=ngozi@example.com" -d "password=strongpass123" -d "confirm_password=strongpass123"
C=$(status -b "$JAR" "$BASE/admin")
check "ordinary member cannot open admin" "$C" "403"
T=$(csrf "$ADMIN_JAR" /admin/members/2/edit)
C=$(status -b "$ADMIN_JAR" -c "$ADMIN_JAR" -X POST "$BASE/admin/members/2/edit" \
  -F "_csrf=$T" -F "full_name=Ngozi Eze" -F "office=Treasurer" -F "occupation=Accountant")
check "admin edits another member" "$C" "302"
curl -s "$BASE/" | grep -q "Treasurer" && ok "treasurer shows on the home page" || bad "treasurer shows on the home page"
CT=$(curl -s -o /dev/null -w '%{content_type}' "$BASE/photo/2")
echo "$CT" | grep -q "svg" && ok "member with no photo gets the placeholder" || bad "placeholder for missing photo" "got $CT"

echo "== Last-admin protection =="
T=$(csrf "$ADMIN_JAR" /admin/members/1/edit)
C=$(status -b "$ADMIN_JAR" -c "$ADMIN_JAR" -X POST "$BASE/admin/members/1/edit" \
  -F "_csrf=$T" -F "full_name=Chidi Okoro" -F "office=President")
check "the only admin cannot drop admin rights" "$C" "400"

echo "== News =="
T=$(csrf "$ADMIN_JAR" /admin/news/new)
C=$(status -b "$ADMIN_JAR" -c "$ADMIN_JAR" -X POST "$BASE/admin/news/new" \
  -d "_csrf=$T" -d "title=October general meeting" -d "body=Our next general meeting holds on Saturday.")
check "admin posts an update" "$C" "302"
curl -s "$BASE/news" | grep -q "October general meeting" && ok "update lists on the news page" || bad "update lists on the news page"
curl -s "$BASE/" | grep -q "October general meeting" && ok "update shows on the home page" || bad "update shows on the home page"
T=$(csrf "$JAR" /profile)
C=$(status -b "$JAR" -c "$JAR" -X POST "$BASE/admin/news/new" -d "_csrf=$T" -d "title=Sneaky" -d "body=Nope")
check "ordinary member cannot post news" "$C" "403"

echo "== Events =="
T=$(csrf "$ADMIN_JAR" /admin/events/new)
C=$(status -b "$ADMIN_JAR" -c "$ADMIN_JAR" -X POST "$BASE/admin/events/new" \
  -d "_csrf=$T" -d "title=End of year thanksgiving" -d "starts_on=2027-12-18" \
  -d "starts_at=11:00" -d "location=Parish hall, Wuse Zone 3" -d "description=Come and celebrate.")
check "admin adds an event" "$C" "302"
curl -s "$BASE/events" | grep -q "End of year thanksgiving" && ok "event lists on the events page" || bad "event lists on the events page"
curl -s "$BASE/" | grep -q "End of year thanksgiving" && ok "event shows on the home page" || bad "event shows on the home page"
curl -s "$BASE/events/1" | grep -q "11:00 am" && ok "event time renders" || bad "event time renders"
T=$(csrf "$ADMIN_JAR" /admin/events/new)
C=$(status -b "$ADMIN_JAR" -c "$ADMIN_JAR" -X POST "$BASE/admin/events/new" \
  -d "_csrf=$T" -d "title=Bad date" -d "starts_on=2027-02-31")
check "an impossible date is rejected" "$C" "400"

echo "== Directory and search =="
curl -s -b "$JAR" "$BASE/members" | grep -q "Chidi Okoro" && ok "directory lists members" || bad "directory lists members"
curl -s -b "$JAR" "$BASE/members?q=Accountant" | grep -q "Ngozi Eze" && ok "search by occupation works" || bad "search by occupation works"
curl -s -b "$JAR" "$BASE/members?office=executives" | grep -q "Treasurer" && ok "executive filter works" || bad "executive filter works"
curl -s -b "$JAR" "$BASE/members?q=%25" | grep -q "No members matched" && ok "a wildcard search is escaped" || bad "a wildcard search is escaped"

echo "== Login and logout =="
LJ=$(mktemp)
T=$(csrf "$LJ" /login)
C=$(status -b "$LJ" -c "$LJ" -X POST "$BASE/login" -d "_csrf=$T" -d "email=chidi@example.com" -d "password=wrongpass")
check "a wrong password is refused" "$C" "401"
T=$(csrf "$LJ" /login)
C=$(status -b "$LJ" -c "$LJ" -X POST "$BASE/login" -d "_csrf=$T" -d "email=chidi@example.com" -d "password=strongpass123")
check "a correct password signs in" "$C" "302"
T=$(csrf "$LJ" /profile)
C=$(status -b "$LJ" -c "$LJ" -X POST "$BASE/logout" -d "_csrf=$T")
check "sign out redirects" "$C" "302"
C=$(status -b "$LJ" "$BASE/members")
check "sign out really ends the session" "$C" "302"

echo "== Open redirect =="
T=$(csrf "$LJ" /login)
LOC=$(curl -s -o /dev/null -w '%{redirect_url}' -b "$LJ" -c "$LJ" -X POST "$BASE/login" \
  -d "_csrf=$T" -d "email=chidi@example.com" -d "password=strongpass123" -d "next=https://evil.example.com")
echo "$LOC" | grep -q "evil" && bad "an external redirect is blocked" "$LOC" || ok "an external redirect is blocked"

echo
echo "passed: $PASS   failed: $FAIL"
rm -f "$JAR" "$ADMIN_JAR" "$LJ" /tmp/fake.png
exit $((FAIL > 0))
