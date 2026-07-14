#!/bin/bash
# Backend API Test Suite for GymFichaje using curl
# Tests all authentication, settings, admin, and punch endpoints

BASE_URL="http://localhost:8001/api"
ADMIN_EMAIL="admin@gimnasio.es"
ADMIN_PASSWORD="Admin1234!"
EMPLOYEE_EMAIL="empleado@gimnasio.es"
EMPLOYEE_PASSWORD="Empleado123!"

# Cookie jars
ADMIN_COOKIES="/tmp/admin_cookies.txt"
EMPLOYEE_COOKIES="/tmp/employee_cookies.txt"

# Clean up old cookie files
rm -f $ADMIN_COOKIES $EMPLOYEE_COOKIES

echo "================================================================================"
echo "GYMFICHAJE BACKEND API TEST SUITE (CURL)"
echo "================================================================================"
echo ""

# Test 1: Admin Login
echo "================================================================================"
echo "TEST 1: POST /api/auth/login (Admin)"
echo "================================================================================"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  -c $ADMIN_COOKIES)

http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

echo "Status: $http_status"
echo "Response: $body"

if [ "$http_status" = "200" ]; then
    echo "✅ Admin login successful"
else
    echo "❌ Admin login failed"
fi
echo ""

# Test 2: Employee Login
echo "================================================================================"
echo "TEST 2: POST /api/auth/login (Employee)"
echo "================================================================================"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMPLOYEE_EMAIL\",\"password\":\"$EMPLOYEE_PASSWORD\"}" \
  -c $EMPLOYEE_COOKIES)

http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

echo "Status: $http_status"
echo "Response: $body"

if [ "$http_status" = "200" ]; then
    echo "✅ Employee login successful"
else
    echo "❌ Employee login failed"
fi
echo ""

# Test 3: Get current user (Admin)
echo "================================================================================"
echo "TEST 3: GET /api/auth/me (Admin)"
echo "================================================================================"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$BASE_URL/auth/me" \
  -b $ADMIN_COOKIES)

http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

echo "Status: $http_status"
echo "Response: $body"

if [ "$http_status" = "200" ]; then
    echo "✅ Admin /auth/me successful"
else
    echo "❌ Admin /auth/me failed"
fi
echo ""

# Test 4: Get current user (Employee)
echo "================================================================================"
echo "TEST 4: GET /api/auth/me (Employee)"
echo "================================================================================"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$BASE_URL/auth/me" \
  -b $EMPLOYEE_COOKIES)

http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

echo "Status: $http_status"
echo "Response: $body"

if [ "$http_status" = "200" ]; then
    echo "✅ Employee /auth/me successful"
else
    echo "❌ Employee /auth/me failed"
fi
echo ""

# Test 5: Get settings (Admin)
echo "================================================================================"
echo "TEST 5: GET /api/settings (Admin)"
echo "================================================================================"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$BASE_URL/settings" \
  -b $ADMIN_COOKIES)

http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

echo "Status: $http_status"
echo "Response: $body"

if [ "$http_status" = "200" ]; then
    echo "✅ Get settings successful"
else
    echo "❌ Get settings failed"
fi
echo ""

# Test 6: Update settings (Admin)
echo "================================================================================"
echo "TEST 6: PUT /api/settings (Admin)"
echo "================================================================================"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X PUT "$BASE_URL/settings" \
  -H "Content-Type: application/json" \
  -d '{"latitude":40.416775,"longitude":-3.703790,"radius_meters":150}' \
  -b $ADMIN_COOKIES)

http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

echo "Status: $http_status"
echo "Response: $body"

if [ "$http_status" = "200" ]; then
    echo "✅ Update settings successful"
else
    echo "❌ Update settings failed"
fi
echo ""

# Test 7: Update settings (Employee - should fail)
echo "================================================================================"
echo "TEST 7: PUT /api/settings (Employee - Should Fail)"
echo "================================================================================"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X PUT "$BASE_URL/settings" \
  -H "Content-Type: application/json" \
  -d '{"latitude":40.416775,"longitude":-3.703790,"radius_meters":150}' \
  -b $EMPLOYEE_COOKIES)

http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

echo "Status: $http_status"
echo "Response: $body"

if [ "$http_status" = "403" ]; then
    echo "✅ Employee correctly denied access"
else
    echo "❌ Expected 403, got $http_status"
fi
echo ""

# Test 8: Get users (Admin)
echo "================================================================================"
echo "TEST 8: GET /api/admin/users (Admin)"
echo "================================================================================"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$BASE_URL/admin/users" \
  -b $ADMIN_COOKIES)

http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

echo "Status: $http_status"
echo "Response: $body"

if [ "$http_status" = "200" ]; then
    echo "✅ Get users successful"
else
    echo "❌ Get users failed"
fi
echo ""

# Test 9: Get users (Employee - should fail)
echo "================================================================================"
echo "TEST 9: GET /api/admin/users (Employee - Should Fail)"
echo "================================================================================"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$BASE_URL/admin/users" \
  -b $EMPLOYEE_COOKIES)

http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

echo "Status: $http_status"
echo "Response: $body"

if [ "$http_status" = "403" ]; then
    echo "✅ Employee correctly denied access"
else
    echo "❌ Expected 403, got $http_status"
fi
echo ""

# Test 10: Get punches (Employee)
echo "================================================================================"
echo "TEST 10: GET /api/punches (Employee)"
echo "================================================================================"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$BASE_URL/punches" \
  -b $EMPLOYEE_COOKIES)

http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

echo "Status: $http_status"
echo "Response: $body"

if [ "$http_status" = "200" ]; then
    echo "✅ Get punches successful"
else
    echo "❌ Get punches failed"
fi
echo ""

# Test 11: Unauthenticated access
echo "================================================================================"
echo "TEST 11: GET /api/auth/me (Unauthenticated - Should Fail)"
echo "================================================================================"
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$BASE_URL/auth/me")

http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

echo "Status: $http_status"
echo "Response: $body"

if [ "$http_status" = "401" ]; then
    echo "✅ Unauthenticated request correctly rejected"
else
    echo "❌ Expected 401, got $http_status"
fi
echo ""

echo "================================================================================"
echo "TEST COMPLETE"
echo "================================================================================"

# Cleanup
rm -f $ADMIN_COOKIES $EMPLOYEE_COOKIES
