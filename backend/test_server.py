"""Quick test script to verify the server can start"""
import sys
from app.config import get_settings
from app.dependencies import supabase_client

def test_config():
    print("Testing configuration...")
    try:
        settings = get_settings()
        print(f"[OK] Config loaded: {settings.supabase_url}")
        return True
    except Exception as e:
        print(f"[ERROR] Config error: {e}")
        return False

def test_supabase_connection():
    print("Testing Supabase connection...")
    try:
        settings = get_settings()
        client = supabase_client(settings)
        print("[OK] Supabase client created successfully")
        return True
    except Exception as e:
        print(f"[ERROR] Supabase connection error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("Save My Foods - Server Test")
    print("=" * 50)
    print()
    
    config_ok = test_config()
    print()
    
    if config_ok:
        supabase_ok = test_supabase_connection()
        print()
        
        if supabase_ok:
            print("=" * 50)
            print("[SUCCESS] All tests passed! Server should start successfully.")
            print("=" * 50)
            print()
            print("To start the server, run:")
            print("  python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000")
            sys.exit(0)
        else:
            print("[FAILED] Supabase connection failed. Check your API keys.")
            sys.exit(1)
    else:
        print("[FAILED] Configuration failed. Check your settings.")
        sys.exit(1)

