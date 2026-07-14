#!/usr/bin/env python3
"""
Backend API Test Suite for GymFichaje
Tests all authentication, settings, admin, and punch endpoints
"""

import requests
import json
from typing import Dict, Optional

# Base URL for the backend API
BASE_URL = "http://localhost:8001/api"

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@gimnasio.es"
ADMIN_PASSWORD = "Admin1234!"
EMPLOYEE_EMAIL = "empleado@gimnasio.es"
EMPLOYEE_PASSWORD = "Empleado123!"

# Session objects to maintain cookies
admin_session = requests.Session()
employee_session = requests.Session()

def print_test_header(test_name: str):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_response(response: requests.Response, show_body: bool = True):
    """Print response details"""
    print(f"Status Code: {response.status_code}")
    print(f"Headers: {dict(response.headers)}")
    if show_body:
        try:
            print(f"Response Body: {json.dumps(response.json(), indent=2)}")
        except:
            print(f"Response Body: {response.text}")
    print()

def test_login_admin() -> bool:
    """Test 1: POST /api/auth/login with admin credentials"""
    print_test_header("1. Admin Login")
    
    payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = admin_session.post(f"{BASE_URL}/auth/login", json=payload)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("role") == "admin" and data.get("email") == ADMIN_EMAIL:
                print("✅ Admin login successful")
                print(f"   User ID: {data.get('id')}")
                print(f"   Full Name: {data.get('full_name')}")
                print(f"   Role: {data.get('role')}")
                return True
            else:
                print("❌ Admin login returned unexpected data")
                return False
        else:
            print(f"❌ Admin login failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Admin login error: {str(e)}")
        return False

def test_login_employee() -> bool:
    """Test 2: POST /api/auth/login with employee credentials"""
    print_test_header("2. Employee Login")
    
    payload = {
        "email": EMPLOYEE_EMAIL,
        "password": EMPLOYEE_PASSWORD
    }
    
    try:
        response = employee_session.post(f"{BASE_URL}/auth/login", json=payload)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("role") == "employee" and data.get("email") == EMPLOYEE_EMAIL:
                print("✅ Employee login successful")
                print(f"   User ID: {data.get('id')}")
                print(f"   Full Name: {data.get('full_name')}")
                print(f"   Role: {data.get('role')}")
                return True
            else:
                print("❌ Employee login returned unexpected data")
                return False
        else:
            print(f"❌ Employee login failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Employee login error: {str(e)}")
        return False

def test_auth_me_admin() -> bool:
    """Test 3: GET /api/auth/me with admin session"""
    print_test_header("3. Get Current User (Admin)")
    
    try:
        response = admin_session.get(f"{BASE_URL}/auth/me")
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("role") == "admin" and data.get("email") == ADMIN_EMAIL:
                print("✅ Admin /auth/me successful")
                return True
            else:
                print("❌ Admin /auth/me returned unexpected data")
                return False
        else:
            print(f"❌ Admin /auth/me failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Admin /auth/me error: {str(e)}")
        return False

def test_auth_me_employee() -> bool:
    """Test 4: GET /api/auth/me with employee session"""
    print_test_header("4. Get Current User (Employee)")
    
    try:
        response = employee_session.get(f"{BASE_URL}/auth/me")
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("role") == "employee" and data.get("email") == EMPLOYEE_EMAIL:
                print("✅ Employee /auth/me successful")
                return True
            else:
                print("❌ Employee /auth/me returned unexpected data")
                return False
        else:
            print(f"❌ Employee /auth/me failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Employee /auth/me error: {str(e)}")
        return False

def test_get_settings() -> bool:
    """Test 5: GET /api/settings (requires auth)"""
    print_test_header("5. Get Gym Settings (Admin)")
    
    try:
        response = admin_session.get(f"{BASE_URL}/settings")
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if "latitude" in data and "longitude" in data and "radius_meters" in data:
                print("✅ Get settings successful")
                print(f"   Latitude: {data.get('latitude')}")
                print(f"   Longitude: {data.get('longitude')}")
                print(f"   Radius: {data.get('radius_meters')}m")
                return True
            else:
                print("❌ Get settings returned incomplete data")
                return False
        else:
            print(f"❌ Get settings failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Get settings error: {str(e)}")
        return False

def test_update_settings() -> bool:
    """Test 6: PUT /api/settings (requires admin)"""
    print_test_header("6. Update Gym Settings (Admin)")
    
    # Test data: Madrid coordinates with 150m radius
    payload = {
        "latitude": 40.416775,
        "longitude": -3.703790,
        "radius_meters": 150
    }
    
    try:
        response = admin_session.put(f"{BASE_URL}/settings", json=payload)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if (data.get("latitude") == payload["latitude"] and 
                data.get("longitude") == payload["longitude"] and 
                data.get("radius_meters") == payload["radius_meters"]):
                print("✅ Update settings successful")
                return True
            else:
                print("❌ Update settings returned unexpected data")
                return False
        else:
            print(f"❌ Update settings failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Update settings error: {str(e)}")
        return False

def test_update_settings_employee() -> bool:
    """Test 7: PUT /api/settings with employee (should fail)"""
    print_test_header("7. Update Gym Settings (Employee - Should Fail)")
    
    payload = {
        "latitude": 40.416775,
        "longitude": -3.703790,
        "radius_meters": 150
    }
    
    try:
        response = employee_session.put(f"{BASE_URL}/settings", json=payload)
        print_response(response)
        
        if response.status_code == 403:
            print("✅ Employee correctly denied access to update settings")
            return True
        else:
            print(f"❌ Expected 403, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Update settings (employee) error: {str(e)}")
        return False

def test_get_users() -> bool:
    """Test 8: GET /api/admin/users (requires admin)"""
    print_test_header("8. Get All Users (Admin)")
    
    try:
        response = admin_session.get(f"{BASE_URL}/admin/users")
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) >= 2:
                print("✅ Get users successful")
                print(f"   Total users: {len(data)}")
                for user in data:
                    print(f"   - {user.get('full_name')} ({user.get('email')}) - {user.get('role')}")
                return True
            else:
                print("❌ Get users returned unexpected data")
                return False
        else:
            print(f"❌ Get users failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Get users error: {str(e)}")
        return False

def test_get_users_employee() -> bool:
    """Test 9: GET /api/admin/users with employee (should fail)"""
    print_test_header("9. Get All Users (Employee - Should Fail)")
    
    try:
        response = employee_session.get(f"{BASE_URL}/admin/users")
        print_response(response)
        
        if response.status_code == 403:
            print("✅ Employee correctly denied access to user list")
            return True
        else:
            print(f"❌ Expected 403, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Get users (employee) error: {str(e)}")
        return False

def test_get_punches_employee() -> bool:
    """Test 10: GET /api/punches (employee)"""
    print_test_header("10. Get Employee Punches")
    
    try:
        response = employee_session.get(f"{BASE_URL}/punches")
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print("✅ Get punches successful")
                print(f"   Total punches: {len(data)}")
                if len(data) > 0:
                    for punch in data[:3]:  # Show first 3
                        print(f"   - Date: {punch.get('work_date')}, Status: {punch.get('status')}")
                return True
            else:
                print("❌ Get punches returned unexpected data")
                return False
        else:
            print(f"❌ Get punches failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Get punches error: {str(e)}")
        return False

def test_unauthenticated_access() -> bool:
    """Test 11: Verify unauthenticated requests are rejected"""
    print_test_header("11. Unauthenticated Access (Should Fail)")
    
    unauth_session = requests.Session()
    
    try:
        response = unauth_session.get(f"{BASE_URL}/auth/me")
        print_response(response)
        
        if response.status_code == 401:
            print("✅ Unauthenticated request correctly rejected")
            return True
        else:
            print(f"❌ Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Unauthenticated access test error: {str(e)}")
        return False

def run_all_tests():
    """Run all backend tests"""
    print("\n" + "="*80)
    print("GYMFICHAJE BACKEND API TEST SUITE")
    print("="*80)
    
    results = {}
    
    # Authentication tests
    results["Admin Login"] = test_login_admin()
    results["Employee Login"] = test_login_employee()
    results["Admin /auth/me"] = test_auth_me_admin()
    results["Employee /auth/me"] = test_auth_me_employee()
    
    # Settings tests
    results["Get Settings"] = test_get_settings()
    results["Update Settings (Admin)"] = test_update_settings()
    results["Update Settings (Employee - Should Fail)"] = test_update_settings_employee()
    
    # Admin users tests
    results["Get Users (Admin)"] = test_get_users()
    results["Get Users (Employee - Should Fail)"] = test_get_users_employee()
    
    # Punches tests
    results["Get Punches (Employee)"] = test_get_punches_employee()
    
    # Security tests
    results["Unauthenticated Access (Should Fail)"] = test_unauthenticated_access()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    print(f"{'='*80}\n")
    
    return passed == total

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
