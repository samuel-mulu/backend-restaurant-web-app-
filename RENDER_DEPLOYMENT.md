# Render Deployment Guide

This guide will help you deploy the Restaurant Menu Backend to Render.

## Prerequisites

1. A Render account (sign up at [render.com](https://render.com))
2. A MongoDB database (MongoDB Atlas recommended for cloud deployment)
3. All environment variables ready (see below)

## Quick Deploy with render.yaml

The repository includes a `render.yaml` file that automates the deployment configuration.

### Steps:

1. **Push your code to GitHub/GitLab/Bitbucket**

   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

2. **Connect Repository to Render**

   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Blueprint"
   - Connect your repository
   - Render will automatically detect `render.yaml`

3. **Set Environment Variables in Render Dashboard**

   After the service is created, go to the service settings and add these **required** environment variables:

   **Required:**

   - `MONGO_URI` - Your MongoDB connection string
     - **For this project:** `mongodb+srv://planetranking067:4dPAQjfAXrOJBlIl@cluster0.dxfb4ya.mongodb.net/3t-juice?retryWrites=true&w=majority&appName=Cluster0`
     - Note: Database name is "3t-juice" (hyphenated, as MongoDB doesn't support spaces in database names)
     - Alternative with space (URL-encoded): `mongodb+srv://planetranking067:4dPAQjfAXrOJBlIl@cluster0.dxfb4ya.mongodb.net/3t%20juice?retryWrites=true&w=majority&appName=Cluster0`
   - `JWT_SECRET` - A secure random string for JWT access tokens
   - `JWT_REFRESH_SECRET` - A secure random string for JWT refresh tokens
   - `CORS_ORIGIN` - Your frontend URL (e.g., `https://your-frontend.onrender.com` or `https://yourdomain.com`)

   **Optional but Recommended:**

   - `COOKIE_DOMAIN` - Your domain (e.g., `.yourdomain.com` for all subdomains)
   - `CLOUDINARY_CLOUD_NAME` - If using Cloudinary for image uploads
   - `CLOUDINARY_API_KEY` - Cloudinary API key
   - `CLOUDINARY_API_SECRET` - Cloudinary API secret
   - `CLOUDINARY_URL` - Cloudinary URL

   **Optional:**

   - `SMTP_HOST` - Email server host
   - `SMTP_PORT` - Email server port (default: 587)
   - `SMTP_USER` - Email username
   - `SMTP_PASS` - Email password
   - `SMTP_FROM_NAME` - Sender name
   - `SMTP_FROM_EMAIL` - Sender email
   - `POS_PRINTER_URL` - POS printer service URL (if applicable)
   - `POS_PRINTER_KEY` - POS printer service key

4. **Deploy**
   - Render will automatically build and deploy your service
   - The build command runs: `npm install && npm run build`
   - The start command runs: `npm start`

## Manual Deployment (Without render.yaml)

If you prefer to set up manually:

1. **Create a New Web Service**

   - Go to Render Dashboard
   - Click "New +" → "Web Service"
   - Connect your repository

2. **Configure Build & Start Commands**

   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment:** `Node`

3. **Set Environment Variables**

   - Add all required environment variables (see list above)

4. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy

## Environment Variables Reference

### Required Variables

| Variable             | Description                   | Example                                                                                                                              |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `MONGO_URI`          | MongoDB connection string     | `mongodb+srv://planetranking067:4dPAQjfAXrOJBlIl@cluster0.dxfb4ya.mongodb.net/3t-juice?retryWrites=true&w=majority&appName=Cluster0` |
| `JWT_SECRET`         | Secret for JWT access tokens  | Generate a secure random string                                                                                                      |
| `JWT_REFRESH_SECRET` | Secret for JWT refresh tokens | Generate a secure random string                                                                                                      |
| `CORS_ORIGIN`        | Frontend URL for CORS         | `https://your-frontend.onrender.com`                                                                                                 |

### Optional Variables

| Variable                | Default                 | Description                                  |
| ----------------------- | ----------------------- | -------------------------------------------- |
| `NODE_ENV`              | `production`            | Node environment                             |
| `PORT`                  | Auto-assigned by Render | Server port (Render sets this automatically) |
| `JWT_ACCESS_EXPIRES`    | `15m`                   | Access token expiration                      |
| `JWT_REFRESH_EXPIRES`   | `30d`                   | Refresh token expiration                     |
| `SECURE_COOKIES`        | `true`                  | Use secure cookies (HTTPS only)              |
| `COOKIE_DOMAIN`         | -                       | Cookie domain                                |
| `CLOUDINARY_CLOUD_NAME` | -                       | Cloudinary cloud name                        |
| `CLOUDINARY_API_KEY`    | -                       | Cloudinary API key                           |
| `CLOUDINARY_API_SECRET` | -                       | Cloudinary API secret                        |
| `CLOUDINARY_URL`        | -                       | Cloudinary URL                               |

## Generating Secure JWT Secrets

You can generate secure random strings for JWT secrets using:

**Node.js:**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**OpenSSL:**

```bash
openssl rand -hex 64
```

**Online:** Use a secure random string generator (64+ characters recommended)

## MongoDB Setup

### Option 1: MongoDB Atlas (Recommended)

1. Sign up at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Create a database user
4. Whitelist Render's IP addresses (or use `0.0.0.0/0` for all IPs)
5. Get your connection string: `mongodb+srv://username:password@cluster.mongodb.net/database-name`

### Option 2: Render MongoDB

1. In Render Dashboard, create a new MongoDB service
2. Use the internal connection string provided by Render

## Post-Deployment

1. **Verify Health Check**

   ```bash
   curl https://your-service.onrender.com/health
   ```

   Should return:

   ```json
   {
     "status": "ok",
     "mongo": {
       "status": "connected",
       "readyState": 1
     }
   }
   ```

2. **Test API Endpoints**

   - Test authentication: `POST /api/v1/auth/register`
   - Test health: `GET /health`

3. **Update Frontend**
   - Update your frontend's API base URL to point to your Render service
   - Update CORS settings if needed

## Troubleshooting

### Build Fails

- Check that TypeScript compiles: `npm run build` locally
- Ensure all dependencies are in `package.json`
- Check build logs in Render dashboard

### Service Won't Start

- Verify `MONGO_URI` is correct and accessible
- Check that all required environment variables are set
- Review logs in Render dashboard

### Database Connection Issues

- Verify MongoDB connection string is correct
- Check MongoDB network access (whitelist IPs)
- Ensure database user has proper permissions

### CORS Errors

- Verify `CORS_ORIGIN` matches your frontend URL exactly
- Check that `SECURE_COOKIES` is set appropriately
- Ensure `COOKIE_DOMAIN` is set if using custom domain

## Custom Domain Setup

1. In Render service settings, add your custom domain
2. Update DNS records as instructed by Render
3. Update `CORS_ORIGIN` to your custom domain
4. Update `COOKIE_DOMAIN` if needed

## Monitoring

- View logs in Render dashboard
- Set up health check monitoring
- Monitor service metrics (CPU, memory, response time)

## Cost Considerations

- **Starter Plan**: Free tier available (spins down after inactivity)
- **Standard Plan**: Always-on service (paid)
- **MongoDB Atlas**: Free tier available (512MB storage)

## Support

For issues:

1. Check Render service logs
2. Verify environment variables
3. Test locally with same configuration
4. Check [Render Documentation](https://render.com/docs)

---

**Ready to deploy?** Push your code and connect to Render!
