#!/bin/bash
# test_concurrency.sh
# Purpose: Fires 5 simultaneous requests to the trade API to verify PostgreSQL row-level locks.

API_URL="http://localhost:3000/api/trade"
USER_ID="test_user_123" # Make sure this user exists in your test database with $1000 USD!

echo "=================================================="
echo "Starting Concurrency Test: Firing 5 simultaneous BUY requests..."
echo "Target: $API_URL"
echo "=================================================="

# Loop 5 times and push the curl command to the background using '&'
for i in {1..5}; do
  curl -s -w "\n[Request $i] Status: %{http_code}" -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"type\": \"BUY\", \"amountUSD\": 1000}" &
done

# Wait for all background processes to finish
wait

echo -e "\n=================================================="
echo "All concurrent requests finished."
echo "ACTION REQUIRED: Check your PostgreSQL database."
echo "If your locks work, only ONE request should have succeeded (200 OK)."
echo "The other four should have failed (e.g., 400 Bad Request - Insufficient Funds)."
echo "=================================================="