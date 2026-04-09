# MSG91 OTP Integration Guide

This document explains how to integrate and use MSG91 OTP service with HungerWood backend.

## Setup

### 1. Install Dependencies

```bash
npm install axios
```

### 2. Environment Variables

Add the following environment variables to your `.env` file:

```env
# MSG91 Configuration
MSG91_AUTH_KEY=your_msg91_auth_key_here
MSG91_SENDER_ID=HUNGER
MSG91_ENABLED=true

# MSG91 WhatsApp Configuration (Optional - Preferred over SMS)
MSG91_WHATSAPP_ENABLED=true
MSG91_WHATSAPP_INTEGRATED_NUMBER=919155992423
MSG91_WHATSAPP_TEMPLATE_NAME=login_otp
MSG91_WHATSAPP_NAMESPACE=22f164c0_2ccc_4c00_b179_2b6870382ae3
MSG91_WHATSAPP_LANGUAGE_CODE=en
```

### 3. Get MSG91 Credentials

1. Sign up at [MSG91](https://msg91.com/)
2. Get your Auth Key from the dashboard
3. Set up a sender ID (6 characters, alphanumeric)
4. Configure your OTP template

### 4. Get MSG91 WhatsApp Credentials (For WhatsApp OTP)

1. Enable WhatsApp API in your MSG91 dashboard
2. Get your integrated WhatsApp number (e.g., `919155992423`)
3. Create and approve a WhatsApp template (e.g., `login_otp`)
4. Get the template namespace from MSG91 dashboard
5. Configure template variables:
   - `body_1`: For OTP value
   - `button_1`: Optional button value (if needed)

## Integration Methods

### Method 1: MSG91 Widget (Recommended)

The MSG91 widget handles OTP sending and verification on the frontend. The backend only needs to verify the access token.

#### Frontend Integration

1. Include MSG91 widget script in your HTML:
```html
<script src="https://widget.msg91.com/widget.min.js"></script>
```

2. Initialize the widget:
```javascript
window.MSG91.init({
  authkey: "YOUR_MSG91_AUTH_KEY",
  template_id: "YOUR_TEMPLATE_ID",
  widget_id: "YOUR_WIDGET_ID"
});
```

3. After user completes OTP verification, get the access token:
```javascript
const accessToken = window.MSG91.getAccessToken();
```

4. Send the access token to backend:
```javascript
const response = await fetch('/api/auth/verify-msg91-token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    accessToken: accessToken
  })
});
```

#### Backend Endpoint

**POST** `/api/auth/verify-msg91-token`

Request body:
```json
{
  "accessToken": "jwt_token_from_msg91_widget"
}
```

Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "phone": "9876543210",
      "name": "Customer",
      "email": null,
      "role": "customer"
    },
    "token": "jwt_token",
    "isProfileComplete": false
  }
}
```

### Method 2: Manual OTP (Fallback)

If MSG91 widget is not used, the system falls back to manual OTP verification.

#### Send OTP

**POST** `/api/auth/send-otp`

Request body:
```json
{
  "phone": "9876543210"
}
```

The system will send OTP in the following priority order:
1. **WhatsApp** (if `MSG91_WHATSAPP_ENABLED=true` and configured) - Preferred method
2. **SMS** (if `MSG91_ENABLED=true` and WhatsApp fails or is not enabled)
3. **Console log** (development mode only, if MSG91 is disabled)

#### Verify OTP

**POST** `/api/auth/verify-otp`

Request body:
```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

The system will:
1. First try MSG91 verification (if enabled)
2. Fall back to local verification if MSG91 fails

## API Endpoints

### 1. Verify MSG91 Widget Token
- **Endpoint**: `POST /api/auth/verify-msg91-token`
- **Description**: Verifies MSG91 widget access token and logs in/registers user
- **Body**: `{ "accessToken": "jwt_token" }`

### 2. Send OTP
- **Endpoint**: `POST /api/auth/send-otp`
- **Description**: Sends OTP to phone number (uses MSG91 if enabled)
- **Body**: `{ "phone": "9876543210" }`

### 3. Verify OTP
- **Endpoint**: `POST /api/auth/verify-otp`
- **Description**: Verifies OTP and logs in/registers user
- **Body**: `{ "phone": "9876543210", "otp": "123456" }`

## Configuration

### Enable/Disable MSG91

#### WhatsApp OTP (Recommended)
Set `MSG91_WHATSAPP_ENABLED=true` in `.env` to enable WhatsApp OTP integration. This is the preferred method as it provides better delivery rates and user experience.

Required WhatsApp configuration:
- `MSG91_WHATSAPP_INTEGRATED_NUMBER`: Your MSG91 WhatsApp integrated number
- `MSG91_WHATSAPP_TEMPLATE_NAME`: Name of your approved WhatsApp template (e.g., `login_otp`)
- `MSG91_WHATSAPP_NAMESPACE`: Template namespace from MSG91 dashboard
- `MSG91_WHATSAPP_LANGUAGE_CODE`: Language code (default: `en`)

#### SMS OTP (Fallback)
Set `MSG91_ENABLED=true` in `.env` to enable SMS OTP integration. This will be used as a fallback if WhatsApp fails or is not configured.

When both are disabled:
- OTPs are generated and stored locally
- In development, OTPs are logged to console
- In production, you need to implement your own SMS/WhatsApp sending

### Phone Number Format

MSG91 requires phone numbers in format: `91XXXXXXXXXX` (country code + 10 digits)

The service automatically formats phone numbers:
- Removes `+91` prefix if present
- Removes non-digit characters
- Adds `91` country code

## Error Handling

All MSG91 API errors are logged and handled gracefully:

1. If MSG91 token verification fails, returns error response
2. If WhatsApp OTP send fails, automatically falls back to SMS (if enabled)
3. If SMS OTP send fails, falls back to local storage
4. If MSG91 OTP verify fails, falls back to local verification

### WhatsApp OTP Fallback Strategy

The system implements a smart fallback mechanism:
1. **Primary**: Try sending via WhatsApp
2. **Fallback**: If WhatsApp fails, try SMS (if `MSG91_ENABLED=true`)
3. **Final**: If both fail, OTP is still stored locally and can be verified manually

## Testing

### Development Mode

When `NODE_ENV=development`:
- OTPs are logged to console even if MSG91 is enabled
- This helps with testing without consuming MSG91 credits

### Production Mode

When `NODE_ENV=production`:
- OTPs are sent via MSG91 (if enabled)
- No OTPs are logged to console
- All errors are logged to error.log

## Troubleshooting

### Common Issues

1. **"MSG91 AuthKey not configured"**
   - Check that `MSG91_AUTH_KEY` is set in `.env`
   - Restart the server after adding environment variables

2. **"Token verification failed"**
   - Verify the access token is valid
   - Check MSG91 dashboard for API status
   - Ensure AuthKey is correct

3. **OTP not received**
   - Check MSG91 dashboard for delivery status
   - Verify phone number format
   - Check sender ID configuration (for SMS)
   - Verify WhatsApp template is approved (for WhatsApp)
   - Check WhatsApp integrated number is correct
   - Verify template namespace matches your template
   - Ensure template variables match (body_1 for OTP value)

4. **Widget not working**
   - Ensure MSG91 widget script is loaded
   - Check browser console for errors
   - Verify widget_id and template_id are correct

## Support

For MSG91 API issues, refer to:
- [MSG91 Documentation](https://docs.msg91.com/)
- [MSG91 Support](https://msg91.com/support)
