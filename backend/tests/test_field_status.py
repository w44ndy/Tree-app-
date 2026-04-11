"""
Test Field Status Feature - Wilson Contractors TMS
Tests for:
- GET /api/field-status - Get current ready counts
- PUT /api/field-status - Update a colour's ready count
- POST /api/field-collections - Create field collection (auto-decrements field status)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFieldStatusFeature:
    """Field Status feature tests - marking pallets ready for collection"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for all tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@wilsoncontractors.co.uk",
            "password": "Wilson2026!"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    # ── GET /api/field-status Tests ──────────────────────────────
    def test_get_field_status_returns_200(self):
        """GET /api/field-status should return 200 with list of statuses"""
        response = self.session.get(f"{BASE_URL}/api/field-status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/field-status returns 200 with {len(data)} status entries")
    
    def test_get_field_status_structure(self):
        """Field status entries should have color, quantity, id fields"""
        response = self.session.get(f"{BASE_URL}/api/field-status")
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            entry = data[0]
            assert "color" in entry, "Entry should have 'color' field"
            assert "quantity" in entry, "Entry should have 'quantity' field"
            assert "id" in entry, "Entry should have 'id' field"
            assert isinstance(entry["quantity"], int), "Quantity should be integer"
            print(f"✓ Field status entry structure valid: color={entry['color']}, quantity={entry['quantity']}")
        else:
            print("✓ Field status list is empty (no entries yet)")
    
    # ── PUT /api/field-status Tests ──────────────────────────────
    def test_update_field_status_returns_200(self):
        """PUT /api/field-status should update and return the status"""
        # First get colours to use a valid colour
        colours_response = self.session.get(f"{BASE_URL}/api/colours")
        assert colours_response.status_code == 200
        colours = colours_response.json()
        if len(colours) == 0:
            pytest.skip("No colours available to test")
        
        test_color = colours[0]["color"]
        test_quantity = 7
        
        response = self.session.put(f"{BASE_URL}/api/field-status", json={
            "color": test_color,
            "quantity": test_quantity
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["color"] == test_color, f"Expected color {test_color}, got {data['color']}"
        assert data["quantity"] == test_quantity, f"Expected quantity {test_quantity}, got {data['quantity']}"
        print(f"✓ PUT /api/field-status updated {test_color} to {test_quantity}")
    
    def test_update_field_status_persists(self):
        """Updated field status should persist and be retrievable via GET"""
        # Get a colour
        colours_response = self.session.get(f"{BASE_URL}/api/colours")
        colours = colours_response.json()
        if len(colours) == 0:
            pytest.skip("No colours available")
        
        test_color = colours[0]["color"]
        test_quantity = 8
        
        # Update
        self.session.put(f"{BASE_URL}/api/field-status", json={
            "color": test_color,
            "quantity": test_quantity
        })
        
        # Verify via GET
        response = self.session.get(f"{BASE_URL}/api/field-status")
        assert response.status_code == 200
        data = response.json()
        found = next((s for s in data if s["color"] == test_color), None)
        assert found is not None, f"Status for {test_color} not found"
        assert found["quantity"] == test_quantity, f"Expected {test_quantity}, got {found['quantity']}"
        print(f"✓ Field status persisted: {test_color} = {test_quantity}")
    
    def test_update_field_status_minimum_zero(self):
        """Field status quantity should not go below 0"""
        colours_response = self.session.get(f"{BASE_URL}/api/colours")
        colours = colours_response.json()
        if len(colours) == 0:
            pytest.skip("No colours available")
        
        test_color = colours[0]["color"]
        
        # Try to set negative quantity
        response = self.session.put(f"{BASE_URL}/api/field-status", json={
            "color": test_color,
            "quantity": -5
        })
        assert response.status_code == 200
        data = response.json()
        assert data["quantity"] >= 0, f"Quantity should be >= 0, got {data['quantity']}"
        print(f"✓ Negative quantity clamped to {data['quantity']}")
    
    def test_update_field_status_upsert(self):
        """PUT should create entry if colour doesn't exist in field_status"""
        # Use a test colour name
        test_color = "testcolor"
        test_quantity = 3
        
        response = self.session.put(f"{BASE_URL}/api/field-status", json={
            "color": test_color,
            "quantity": test_quantity
        })
        assert response.status_code == 200
        data = response.json()
        assert data["color"] == test_color
        assert data["quantity"] == test_quantity
        print(f"✓ Field status upsert works for new colour: {test_color}")
    
    # ── Field Collection Auto-Decrement Tests ────────────────────
    def test_field_collection_auto_decrements_status(self):
        """Creating a field collection should auto-decrement field status"""
        # Get colours
        colours_response = self.session.get(f"{BASE_URL}/api/colours")
        colours = colours_response.json()
        if len(colours) == 0:
            pytest.skip("No colours available")
        
        test_color = colours[0]["color"]
        
        # Set field status to 10
        self.session.put(f"{BASE_URL}/api/field-status", json={
            "color": test_color,
            "quantity": 10
        })
        
        # Create field collection with 3 pallets of that colour
        collection_response = self.session.post(f"{BASE_URL}/api/field-collections", json={
            "items": [{"color": test_color, "quantity": 3}],
            "notes": "Test auto-decrement"
        })
        assert collection_response.status_code == 200, f"Collection failed: {collection_response.text}"
        
        # Verify field status decremented
        status_response = self.session.get(f"{BASE_URL}/api/field-status")
        data = status_response.json()
        found = next((s for s in data if s["color"] == test_color), None)
        assert found is not None
        # Should be 10 - 3 = 7
        assert found["quantity"] == 7, f"Expected 7 after decrement, got {found['quantity']}"
        print(f"✓ Field status auto-decremented: 10 - 3 = {found['quantity']}")
    
    def test_field_collection_decrement_not_below_zero(self):
        """Auto-decrement should not go below 0"""
        colours_response = self.session.get(f"{BASE_URL}/api/colours")
        colours = colours_response.json()
        if len(colours) == 0:
            pytest.skip("No colours available")
        
        test_color = colours[0]["color"]
        
        # Set field status to 2
        self.session.put(f"{BASE_URL}/api/field-status", json={
            "color": test_color,
            "quantity": 2
        })
        
        # Create field collection with 5 pallets (more than available)
        collection_response = self.session.post(f"{BASE_URL}/api/field-collections", json={
            "items": [{"color": test_color, "quantity": 5}],
            "notes": "Test decrement floor"
        })
        assert collection_response.status_code == 200
        
        # Verify field status is 0, not negative
        status_response = self.session.get(f"{BASE_URL}/api/field-status")
        data = status_response.json()
        found = next((s for s in data if s["color"] == test_color), None)
        assert found is not None
        assert found["quantity"] == 0, f"Expected 0 (floor), got {found['quantity']}"
        print(f"✓ Field status floored at 0 after over-collection")
    
    # ── GET /api/colours Tests ───────────────────────────────────
    def test_get_colours_returns_200(self):
        """GET /api/colours should return list of colours"""
        response = self.session.get(f"{BASE_URL}/api/colours")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/colours returns {len(data)} colours")
    
    # ── GET /api/field-collections Tests ─────────────────────────
    def test_get_field_collections_returns_200(self):
        """GET /api/field-collections should return list of collections"""
        response = self.session.get(f"{BASE_URL}/api/field-collections")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/field-collections returns {len(data)} collections")
    
    def test_field_collection_structure(self):
        """Field collection should have items, total_pallets, collected_by"""
        response = self.session.get(f"{BASE_URL}/api/field-collections")
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            entry = data[0]
            assert "items" in entry, "Should have 'items' field"
            assert "total_pallets" in entry, "Should have 'total_pallets' field"
            assert "collected_by" in entry, "Should have 'collected_by' field"
            assert "created_at" in entry, "Should have 'created_at' field"
            print(f"✓ Field collection structure valid: {entry['total_pallets']} pallets by {entry['collected_by']}")
        else:
            print("✓ No field collections yet")
    
    # ── Authentication Tests ─────────────────────────────────────
    def test_field_status_requires_auth(self):
        """Field status endpoints should require authentication"""
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/field-status")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/field-status requires authentication")
    
    def test_field_status_update_requires_auth(self):
        """PUT /api/field-status should require authentication"""
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        response = unauth_session.put(f"{BASE_URL}/api/field-status", json={
            "color": "green",
            "quantity": 5
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ PUT /api/field-status requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
