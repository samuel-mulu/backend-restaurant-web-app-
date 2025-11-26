# MongoDB Connection String

## Database: 3T JUICE

### Connection String (Recommended - with hyphen)

```
mongodb+srv://planetranking067:4dPAQjfAXrOJBlIl@cluster0.dxfb4ya.mongodb.net/3t-juice?retryWrites=true&w=majority&appName=Cluster0
```

**Database Name:** `3t-juice` (hyphenated - recommended, as MongoDB doesn't support spaces)

### Connection String (Alternative - with URL-encoded space)

If you need to use "3t juice" with a space:

```
mongodb+srv://planetranking067:4dPAQjfAXrOJBlIl@cluster0.dxfb4ya.mongodb.net/3t%20juice?retryWrites=true&w=majority&appName=Cluster0
```

**Database Name:** `3t juice` (URL-encoded space: `%20`)

## Usage

### For Local Development (.env file)

```env
MONGO_URI=mongodb+srv://planetranking067:4dPAQjfAXrOJBlIl@cluster0.dxfb4ya.mongodb.net/3t-juice?retryWrites=true&w=majority&appName=Cluster0
```

### For Render Deployment

Set the `MONGO_URI` environment variable in Render dashboard with the connection string above.

## Notes

- **Recommended:** Use `3t-juice` (hyphenated) as it's cleaner and more standard
- The database will be created automatically when you first connect
- Make sure your MongoDB Atlas IP whitelist includes Render's IP addresses (or use `0.0.0.0/0` for all IPs)
- The connection string includes authentication credentials - keep it secure!

## Testing Connection

You can test the connection using MongoDB Compass or the MongoDB shell:

```bash
mongosh "mongodb+srv://planetranking067:4dPAQjfAXrOJBlIl@cluster0.dxfb4ya.mongodb.net/3t-juice?retryWrites=true&w=majority&appName=Cluster0"
```

