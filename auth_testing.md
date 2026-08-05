# Auth Testing Playbook (Emergent Google OAuth)

## Create Test User & Session (mongosh)
```
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
```
## Test via API
- GET /api/auth/me -H "Authorization: Bearer <sessionToken>"
- GET /api/visits/history -H "Authorization: Bearer <sessionToken>"

## Browser cookie set
```
page.context.add_cookies([{"name":"session_token","value":"<TOKEN>","domain":"<host>","path":"/","httpOnly":true,"secure":true,"sameSite":"None"}])
```
