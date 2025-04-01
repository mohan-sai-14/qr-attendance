# Deploying Your Attendance App to Vercel

This guide will walk you through the process of deploying your attendance application to Vercel.

## Prerequisites

1. A [Vercel account](https://vercel.com/signup)
2. [Git](https://git-scm.com/downloads) installed on your computer
3. [Node.js](https://nodejs.org/) (v16 or higher) installed on your computer
4. [Vercel CLI](https://vercel.com/docs/cli) installed globally on your machine

## Setup Steps

### 1. Install Vercel CLI (if not already installed)

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Push Your Code to GitHub

If your code is not already on GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/your-repository.git
git push -u origin main
```

### 4. Deploy Using Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." > "Project"
3. Import your GitHub repository
4. Configure your project:
   - Set the framework preset to "Other"
   - Build Command: `cd app && npm install && npm run build`
   - Output Directory: `app/dist`
   - Install Command: `npm install`
5. Add all environment variables from `.env.production` to the Vercel project:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - SESSION_SECRET
   - NODE_ENV (set to "production")
6. Click "Deploy"

### 5. Alternative: Deploy Using Vercel CLI

Run the following command in your project root:

```bash
vercel
```

Follow the prompts to configure your deployment.

### 6. Verify Deployment

1. Once deployment is complete, Vercel will provide a URL for your application.
2. Visit the URL to ensure your application is working correctly.
3. Test all features, especially those that rely on the Supabase backend.

## Troubleshooting

### API Routes Not Working

- Check that the `/api` route is being properly redirected to your serverless functions
- Verify that all environment variables are correctly set in the Vercel dashboard

### Database Connection Issues

- Make sure your Supabase instance allows connections from your Vercel deployment
- Verify that your environment variables are correctly set

### Build Failures

- Check the build logs in your Vercel dashboard
- Ensure that all dependencies are properly installed
- Verify that the build command is correctly configured

## Adding a Custom Domain

1. In the Vercel dashboard, go to your project settings
2. Navigate to the "Domains" section
3. Add your custom domain and follow the instructions for DNS configuration

## Continuous Deployment

Vercel automatically sets up continuous deployment from your connected GitHub repository. Any push to your main branch will trigger a new deployment.

## Need Help?

If you encounter any issues during deployment, you can:
- Check the [Vercel documentation](https://vercel.com/docs)
- Contact Vercel support
- Review the error logs in your Vercel dashboard 