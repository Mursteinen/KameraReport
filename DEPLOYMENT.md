# Deployment Guide - Render.com

This guide will walk you through deploying your Kamera Inspection Reports application to Render.com's free tier.

## Prerequisites

- A GitHub account (to host your code)
- A Render.com account (free - sign up at https://render.com)

## Step 1: Prepare Your Code for Git

Your project now includes the necessary deployment configuration files:
- `.gitignore` - Excludes unnecessary files from version control
- `render.yaml` - Configures Render deployment settings
- `package.json` - Updated with Node.js version requirements

## Step 2: Initialize Git Repository (if not already done)

Open your terminal in the project directory and run:

```bash
git init
git add .
git commit -m "Initial commit - Ready for deployment"
```

## Step 3: Push to GitHub

1. Go to https://github.com and create a new repository
2. Name it something like "kamera-reports" (don't initialize with README)
3. Follow GitHub's instructions to push your existing repository:

```bash
git remote add origin https://github.com/Mursteinen/KameraReport.git
git branch -M main
git push -u origin main
```

## Step 4: Deploy on Render.com

1. **Sign Up/Login to Render**
   - Go to https://render.com
   - Sign up or log in (you can use your GitHub account)

2. **Connect GitHub Repository**
   - Click "New +" button in the top right
   - Select "Web Service"
   - Connect your GitHub account if not already connected
   - Select the repository you just created

3. **Configure the Service**
   Render should auto-detect the `render.yaml` configuration, but verify these settings:
   - **Name**: kamera-reports (or your preferred name)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

4. **Add Persistent Disk (IMPORTANT)**
   - Scroll down to "Disks" section
   - Add a disk with these settings:
     - **Name**: data
     - **Mount Path**: `/opt/render/project/src`
     - **Size**: 1 GB (free tier allows up to 1GB)
   
   This is crucial for:
   - Storing your SQLite database permanently
   - Keeping uploaded PDFs and images
   - Preventing data loss on redeploys

5. **Deploy**
   - Click "Create Web Service"
   - Render will automatically build and deploy your app
   - Wait 5-10 minutes for the first deployment

## Step 5: Access Your Application

Once deployed, you'll get a URL like:
```
https://kamera-reports.onrender.com
```

Your application is now live and accessible from anywhere!

## Important Notes

### Free Tier Limitations

1. **Automatic Sleep**
   - Free tier apps sleep after 15 minutes of inactivity
   - First request after sleep takes ~30 seconds to wake up
   - Solution: Upgrade to paid tier ($7/month) for always-on service

2. **Storage**
   - 1GB persistent disk (free)
   - Database and uploads persist between deployments
   - Monitor your storage usage in Render dashboard

3. **Monthly Limits**
   - 750 hours per month (enough for one always-on service)
   - After hours run out, service stops until next month

### Automatic Deployments

- Every time you push to the `main` branch on GitHub, Render automatically redeploys
- To deploy changes:
  ```bash
  git add .
  git commit -m "Description of changes"
  git push
  ```

### Database Backups

Your SQLite database is stored on the persistent disk. To back it up:

1. Go to Render dashboard
2. Open your service
3. Click "Shell" tab
4. Download `kamera_reports.db` file

Or set up automatic backups using Render's backup features (paid plans).

### Environment Variables

Currently not needed, but if you add them later:
1. Go to service settings in Render
2. Add environment variables in the "Environment" section
3. Service will auto-redeploy with new variables

## Troubleshooting

### App won't start
- Check the "Logs" tab in Render dashboard
- Verify all dependencies are in package.json
- Ensure Node version is 18 or higher

### Database not persisting
- Verify the persistent disk is properly mounted
- Check disk settings in Render dashboard
- Ensure mount path is `/opt/render/project/src`

### Uploads not working
- Check the logs for file permission errors
- Verify the disk has sufficient space
- Check that multer is properly configured

### Slow first load
- This is normal for free tier (app sleeps)
- Consider upgrading to paid tier for better performance

## Upgrading to Paid Tier

Benefits of upgrading ($7/month):
- No automatic sleep
- Faster performance
- More disk space options
- Priority support
- Custom domains included

To upgrade:
1. Go to service settings
2. Change instance type from "Free" to "Starter"
3. Confirm billing

## Support

- Render Documentation: https://render.com/docs
- Render Community: https://community.render.com
- GitHub Issues: Create issues in your repository

## Next Steps

1. Test all functionality on your deployed app
2. Share the URL with users
3. Consider setting up a custom domain
4. Monitor usage and performance
5. Set up regular database backups

Your application is now successfully deployed and accessible worldwide!
