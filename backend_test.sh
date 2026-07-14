#!/bin/bash

# GymFichaje Backend Test Suite - Supabase PostgreSQL Migration
# Tests all endpoints with httpOnly cookie authentication

set -e

BASE_URL="http://localhost:8001"
ADMIN_COOKIES="/tmp/admin_cookies.txt"
EMP_COOKIES="/tmp/emp_cookies.txt"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Clean up old cookies
rm -f $ADMIN_COOKIES $EMP_COOKIES

echo "=========================================="
echo "GymFichaje Backend Test Suite"
echo "Testing Supabase PostgreSQL Migration"
echo "=========================================="
echo ""

# Helper function to test endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local cookies="$4"
    local data="$5"
    local expected_status="$6"
    
    echo -n "Testing: $name ... "
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -b "$cookies" -c "$cookies" \
            -H "Content-Type: application/json")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -b "$cookies" -c "$cookies" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        if [ ! -z "$body" ] && [ "$body" != "{}" ]; then
            echo "   Response: $body" | head -c 200
            echo ""
        fi
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $http_code)"
        FAILED=$((FAILED + 1))
        echo "   Response: $body"
        return 1
    fi
}

echo "=== 1. Health Check ==="
test_endpoint "GET /api/ (health check)" "GET" "/api/" "" "" "200"
echo ""

echo "=== 2. Admin Authentication ==="
test_endpoint "POST /api/auth/login (admin)" "POST" "/api/auth/login" "$ADMIN_COOKIES" \
    '{"email":"admin@gimnasio.es","password":"Admin1234!"}' "200"
echo ""

echo "=== 3. Session Verification ==="
test_endpoint "GET /api/auth/me (admin)" "GET" "/api/auth/me" "$ADMIN_COOKIES" "" "200"
echo ""

echo "=== 4. Settings - Read ==="
test_endpoint "GET /api/settings" "GET" "/api/settings" "$ADMIN_COOKIES" "" "200"
echo ""

echo "=== 5. Settings - Update ==="
test_endpoint "PUT /api/settings (update radius to 200m)" "PUT" "/api/settings" "$ADMIN_COOKIES" \
    '{"latitude":40.416775,"longitude":-3.703790,"radius_meters":200}' "200"
echo ""

echo "=== 6. Admin Users - List ==="
test_endpoint "GET /api/admin/users" "GET" "/api/admin/users" "$ADMIN_COOKIES" "" "200"
echo ""

echo "=== 7. Admin Users - Create New User ==="
NEW_USER_DATA='{"email":"test@gimnasio.es","password":"Test1234!","full_name":"Test User","role":"employee"}'
test_endpoint "POST /api/admin/users (create test user)" "POST" "/api/admin/users" "$ADMIN_COOKIES" \
    "$NEW_USER_DATA" "200"

# Extract user_id from response for next tests
if [ $? -eq 0 ]; then
    # Get the newly created user's ID
    USER_LIST=$(curl -s -X GET "$BASE_URL/api/admin/users" -b "$ADMIN_COOKIES" -H "Content-Type: application/json")
    TEST_USER_ID=$(echo "$USER_LIST" | grep -o '"id":"[^"]*","email":"test@gimnasio.es"' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    echo "   Created user ID: $TEST_USER_ID"
fi
echo ""

echo "=== 8. Admin Users - Toggle Active ==="
if [ ! -z "$TEST_USER_ID" ]; then
    test_endpoint "PATCH /api/admin/users/{user_id}/toggle-active" "PATCH" \
        "/api/admin/users/$TEST_USER_ID/toggle-active" "$ADMIN_COOKIES" "" "200"
else
    echo -e "${YELLOW}⊘ SKIP${NC} (No user ID available)"
    FAILED=$((FAILED + 1))
fi
echo ""

echo "=== 9. Admin Users - Reset Password ==="
if [ ! -z "$TEST_USER_ID" ]; then
    test_endpoint "POST /api/admin/users/{user_id}/reset-password" "POST" \
        "/api/admin/users/$TEST_USER_ID/reset-password" "$ADMIN_COOKIES" \
        '{"new_password":"NewPass123!"}' "200"
else
    echo -e "${YELLOW}⊘ SKIP${NC} (No user ID available)"
    FAILED=$((FAILED + 1))
fi
echo ""

echo "=== 10. Admin Logout ==="
test_endpoint "POST /api/auth/logout (admin)" "POST" "/api/auth/logout" "$ADMIN_COOKIES" "" "200"
echo ""

echo "=== 11. Employee Authentication ==="
test_endpoint "POST /api/auth/login (employee)" "POST" "/api/auth/login" "$EMP_COOKIES" \
    '{"email":"empleado@gimnasio.es","password":"Empleado123!"}' "200"
echo ""

echo "=== 12. Employee Punches - List ==="
test_endpoint "GET /api/punches (employee)" "GET" "/api/punches" "$EMP_COOKIES" "" "200"
echo ""

echo "=== 13. Employee Punches - Check In ==="
CHECKIN_DATA='{"latitude":null,"longitude":null,"note":"Test check-in without geofencing"}'
CHECKIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/punches/checkin" \
    -b "$EMP_COOKIES" -c "$EMP_COOKIES" \
    -H "Content-Type: application/json" \
    -d "$CHECKIN_DATA")

if echo "$CHECKIN_RESPONSE" | grep -q '"id"'; then
    echo -e "Testing: POST /api/punches/checkin ... ${GREEN}✓ PASS${NC} (HTTP 200)"
    PASSED=$((PASSED + 1))
    PUNCH_ID=$(echo "$CHECKIN_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "   Created punch ID: $PUNCH_ID"
    echo "   Response: $CHECKIN_RESPONSE" | head -c 200
    echo ""
else
    echo -e "Testing: POST /api/punches/checkin ... ${RED}✗ FAIL${NC}"
    FAILED=$((FAILED + 1))
    echo "   Response: $CHECKIN_RESPONSE"
fi
echo ""

echo "=== 14. Employee Punches - Check Out ==="
if [ ! -z "$PUNCH_ID" ]; then
    CHECKOUT_DATA='{"latitude":null,"longitude":null,"note":"Test check-out"}'
    test_endpoint "POST /api/punches/checkout/{punch_id}" "POST" \
        "/api/punches/checkout/$PUNCH_ID" "$EMP_COOKIES" "$CHECKOUT_DATA" "200"
else
    echo -e "${YELLOW}⊘ SKIP${NC} (No punch ID available)"
    FAILED=$((FAILED + 1))
fi
echo ""

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    exit 1
fi
