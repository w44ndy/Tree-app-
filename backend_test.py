#!/usr/bin/env python3
"""
Wilson Contractors Tree Management System - Backend API Tests
Tests all API endpoints for the Christmas tree logistics system
"""

import requests
import sys
import json
from datetime import datetime

class WilsonTreeAPITester:
    def __init__(self, base_url="https://tree-logistics.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.user_data = None
        self.created_resources = {
            'pallets': [],
            'yard_locations': [],
            'orders': [],
            'lorries': [],
            'loads': []
        }

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        return success

    def run_api_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        
        try:
            if method == 'GET':
                response = self.session.get(url, params=params)
            elif method == 'POST':
                response = self.session.post(url, json=data, params=params)
            elif method == 'PUT':
                response = self.session.put(url, json=data)
            elif method == 'DELETE':
                response = self.session.delete(url)

            success = response.status_code == expected_status
            result_data = {}
            
            if response.headers.get('content-type', '').startswith('application/json'):
                try:
                    result_data = response.json()
                except:
                    pass

            if success:
                self.log_test(name, True)
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}")

            return success, result_data, response.status_code

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}, 0

    def test_auth_flow(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication...")
        
        # Test login with admin credentials
        success, data, status = self.run_api_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            {"email": "admin@wilsoncontractors.co.uk", "password": "Wilson2026!"}
        )
        
        if success and data:
            self.user_data = data
            print(f"   Logged in as: {data.get('name')} ({data.get('role')})")
        
        # Test /auth/me endpoint
        self.run_api_test("Get Current User", "GET", "auth/me", 200)
        
        return success

    def test_pallets_api(self):
        """Test pallet management endpoints"""
        print("\n📦 Testing Pallets API...")
        
        # List pallets
        self.run_api_test("List Pallets", "GET", "pallets", 200)
        
        # Create a pallet
        pallet_data = {
            "pallet_number": f"WC-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            "tree_color": "green",
            "tree_species": "Nordmann Fir",
            "tree_size": "6ft",
            "quantity": 50,
            "location": "yard",
            "yard_position": "A1",
            "notes": "Test pallet for API testing"
        }
        
        success, data, status = self.run_api_test(
            "Create Pallet",
            "POST",
            "pallets",
            200,
            pallet_data
        )
        
        if success and data.get('id'):
            pallet_id = data['id']
            self.created_resources['pallets'].append(pallet_id)
            
            # Get specific pallet
            self.run_api_test(f"Get Pallet {pallet_id}", "GET", f"pallets/{pallet_id}", 200)
            
            # Update pallet
            update_data = {"notes": "Updated test pallet", "quantity": 45}
            self.run_api_test(f"Update Pallet {pallet_id}", "PUT", f"pallets/{pallet_id}", 200, update_data)
            
            # Generate QR code
            self.run_api_test(f"Generate QR Code for Pallet {pallet_id}", "GET", f"pallets/{pallet_id}/qr", 200)
        
        # Test filtering
        self.run_api_test("Filter Pallets by Color", "GET", "pallets", 200, params={"color": "green"})
        self.run_api_test("Filter Pallets by Status", "GET", "pallets", 200, params={"status": "in_yard"})

    def test_yard_locations_api(self):
        """Test yard location management"""
        print("\n🏭 Testing Yard Locations API...")
        
        # List yard locations
        self.run_api_test("List Yard Locations", "GET", "yard-locations", 200)
        
        # Create yard location
        location_data = {
            "name": f"Test-Section-{datetime.now().strftime('%H%M%S')}",
            "section": "TEST",
            "capacity": 25,
            "description": "Test yard location for API testing"
        }
        
        success, data, status = self.run_api_test(
            "Create Yard Location",
            "POST",
            "yard-locations",
            200,
            location_data
        )
        
        if success and data.get('id'):
            self.created_resources['yard_locations'].append(data['id'])

    def test_orders_api(self):
        """Test order management endpoints"""
        print("\n📋 Testing Orders API...")
        
        # List orders
        self.run_api_test("List Orders", "GET", "orders", 200)
        
        # Create order
        order_data = {
            "customer_name": "Test Customer Ltd",
            "delivery_address": "123 Test Street, Test City, TC1 2TC",
            "contact_phone": "+44 1234 567890",
            "items": [
                {"tree_color": "green", "tree_size": "6ft", "quantity": 10},
                {"tree_color": "blue", "tree_size": "7ft", "quantity": 5}
            ],
            "delivery_date": "2024-12-20",
            "notes": "Test order for API testing"
        }
        
        success, data, status = self.run_api_test(
            "Create Order",
            "POST",
            "orders",
            200,
            order_data
        )
        
        if success and data.get('id'):
            order_id = data['id']
            self.created_resources['orders'].append(order_id)
            
            # Check order fulfillment
            self.run_api_test(f"Check Order Fulfillment {order_id}", "POST", f"orders/{order_id}/check-fulfillment", 200)
            
            # Update order
            update_data = {"status": "confirmed", "notes": "Order confirmed for testing"}
            self.run_api_test(f"Update Order {order_id}", "PUT", f"orders/{order_id}", 200, update_data)

    def test_lorries_api(self):
        """Test lorry management endpoints"""
        print("\n🚛 Testing Lorries API...")
        
        # List lorries
        self.run_api_test("List Lorries", "GET", "lorries", 200)
        
        # Create lorry
        lorry_data = {
            "registration": f"TEST{datetime.now().strftime('%H%M')}",
            "name": "Test Lorry",
            "capacity": 20
        }
        
        success, data, status = self.run_api_test(
            "Create Lorry",
            "POST",
            "lorries",
            200,
            lorry_data
        )
        
        if success and data.get('id'):
            self.created_resources['lorries'].append(data['id'])
            return data['id']
        
        return None

    def test_loads_api(self):
        """Test load management endpoints"""
        print("\n📦 Testing Loads API...")
        
        # List loads
        self.run_api_test("List Loads", "GET", "loads", 200)
        
        # Need a lorry for load creation
        lorry_id = None
        if self.created_resources['lorries']:
            lorry_id = self.created_resources['lorries'][0]
        
        if lorry_id:
            # Create load
            load_data = {
                "lorry_id": lorry_id,
                "destinations": [
                    {
                        "address": "Test Delivery Address, Test City",
                        "notes": "Test delivery for API testing"
                    }
                ],
                "departure_date": "2024-12-20",
                "driver_name": "Test Driver",
                "notes": "Test load for API testing"
            }
            
            success, data, status = self.run_api_test(
                "Create Load",
                "POST",
                "loads",
                200,
                load_data
            )
            
            if success and data.get('id'):
                load_id = data['id']
                self.created_resources['loads'].append(load_id)
                
                # Get specific load
                self.run_api_test(f"Get Load {load_id}", "GET", f"loads/{load_id}", 200)
                
                # Add pallet to load (if we have pallets)
                if self.created_resources['pallets']:
                    pallet_id = self.created_resources['pallets'][0]
                    pallet_data = {"pallet_id": pallet_id, "position": "A1"}
                    self.run_api_test(f"Add Pallet to Load {load_id}", "POST", f"loads/{load_id}/add-pallet", 200, pallet_data)
                
                # Get manifest
                self.run_api_test(f"Get Manifest for Load {load_id}", "GET", f"loads/{load_id}/manifest", 200)
                
                # Update load status
                update_data = {"status": "in_transit"}
                self.run_api_test(f"Update Load Status {load_id}", "PUT", f"loads/{load_id}", 200, update_data)

    def test_stock_and_dashboard(self):
        """Test stock checking and dashboard endpoints"""
        print("\n📊 Testing Stock & Dashboard APIs...")
        
        # Check stock
        self.run_api_test("Check Stock", "GET", "stock/check", 200)
        
        # Dashboard stats
        self.run_api_test("Dashboard Stats", "GET", "dashboard/stats", 200)

    def test_logout(self):
        """Test logout functionality"""
        print("\n🚪 Testing Logout...")
        self.run_api_test("Logout", "POST", "auth/logout", 200)

    def cleanup_resources(self):
        """Clean up created test resources"""
        print("\n🧹 Cleaning up test resources...")
        
        # Delete in reverse order to handle dependencies
        for load_id in self.created_resources['loads']:
            self.run_api_test(f"Delete Load {load_id}", "DELETE", f"loads/{load_id}", 200)
        
        for order_id in self.created_resources['orders']:
            self.run_api_test(f"Delete Order {order_id}", "DELETE", f"orders/{order_id}", 200)
        
        for lorry_id in self.created_resources['lorries']:
            self.run_api_test(f"Delete Lorry {lorry_id}", "DELETE", f"lorries/{lorry_id}", 200)
        
        for location_id in self.created_resources['yard_locations']:
            self.run_api_test(f"Delete Yard Location {location_id}", "DELETE", f"yard-locations/{location_id}", 200)
        
        for pallet_id in self.created_resources['pallets']:
            self.run_api_test(f"Delete Pallet {pallet_id}", "DELETE", f"pallets/{pallet_id}", 200)

    def run_all_tests(self):
        """Run complete test suite"""
        print("🌲 Wilson Contractors Tree Management System - API Tests")
        print("=" * 60)
        
        # Test authentication first
        if not self.test_auth_flow():
            print("❌ Authentication failed - stopping tests")
            return False
        
        # Test all API endpoints
        self.test_pallets_api()
        self.test_yard_locations_api()
        self.test_orders_api()
        lorry_id = self.test_lorries_api()
        self.test_loads_api()
        self.test_stock_and_dashboard()
        
        # Clean up
        self.cleanup_resources()
        
        # Test logout
        self.test_logout()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    """Main test runner"""
    tester = WilsonTreeAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())