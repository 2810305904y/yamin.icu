# Website Update Workflow with GitHub, Vercel, and a Test Site

Document version: V2

This is the active publishing workflow for `鸦珉.icu`.

## Mandatory Publishing Rule

Regular deployment must follow this order:

1. Commit the finished local changes to Git.
2. Push the commit to GitHub.
3. Let Vercel deploy from the GitHub repository automatically.
4. Check the deployed test or production domain after Vercel finishes.

Do not use a local uncommitted workspace as the regular way to deploy to Vercel.

Temporary direct deployment with Vercel CLI is allowed only for urgent preview or debugging. After any temporary direct deployment, clearly state that GitHub is not yet synchronized, then commit and push the same changes to GitHub as soon as possible.

This is a simple workflow for managing a small website, such as a guitar tool website, without sending loose HTML files back and forth forever.

The goal is:

- keep every website update in one organized place;
- make every change reviewable before it goes live;
- keep a stable public website link;
- have a test version for trying updates safely;
- make rollback possible if something breaks.

## 1. The Basic Setup

The recommended setup is:

1. **GitHub repository**
   - Stores the website files.
   - Keeps a history of every change.
   - Makes it possible to see what changed, when it changed, and who changed it.

2. **Vercel project**
   - Hosts the website online.
   - Can automatically deploy the site whenever the GitHub repository is updated.
   - Provides a free `vercel.app` URL even if no custom domain is purchased.

3. **Optional custom domain**
   - Example: `guitartool.com`
   - This is better for branding, long-term public use, SEO, and sharing with users.
   - The website can still work without a custom domain because Vercel provides its own URL.

4. **Test site**
   - Example: `test.guitartool.com`
   - Used to preview updates before moving them to the main public site.
   - This prevents unfinished changes from appearing on the real website.

## 2. Is the Vercel URL Permanent Enough?

Vercel automatically provides a `vercel.app` URL for deployments. This can be used to view and share the site.

For a small internal project, demo, prototype, or early version, the Vercel URL is usually enough.

For the main public website, a custom domain is still recommended because:

- it looks more professional;
- it is easier to remember;
- it is better for branding;
- it gives you more control if you ever move away from Vercel;
- it avoids users depending on a platform-generated URL.

In short:

- **Vercel URL:** fine for testing, demos, and early versions.
- **Custom domain:** better for the final public website.

## 3. Recommended Production and Test Structure

There are two practical ways to do this.

### Option A: One GitHub Repository, Two Vercel Projects

This is simple and clear.

- GitHub repository: stores the website code.
- Vercel production project: serves the main website.
- Vercel test project: serves the test website.

Example:

```txt
Production site:
https://guitartool.com

Test site:
https://test.guitartool.com
```

This is a good setup if the test site should feel like a separate environment.

### Option B: One Vercel Project with Preview Deployments

Vercel can also create preview links for new branches or pull requests.

This is useful when the team is comfortable with Git branches and pull requests.

Example:

```txt
Main branch -> production website
Feature branch -> Vercel preview link
```

This is cleaner for a development team, but the URLs are less friendly for non-technical review.

## 4. Suggested Workflow for Website Updates

For a small website, this workflow is usually enough:

1. The website files are placed in the GitHub repository.
2. A new update is made locally or in a separate branch.
3. The update is committed to Git.
4. The commit is pushed to GitHub.
5. Vercel deploys the update to the test site or creates a preview link from GitHub.
6. The test site is reviewed.
7. If everything looks good, merge or promote through GitHub so Vercel deploys the production site.
8. The production site is checked after deployment.

The normal workflow is GitHub first, Vercel second. Direct local Vercel deployment is not the normal release path.

Older shorthand version:

1. The website files are placed in the GitHub repository.
2. A new update is made locally or in a separate branch.
3. The update is pushed to GitHub.
4. Vercel deploys the update to the test site or creates a preview link.
5. The test site is reviewed.
6. If everything looks good, the update is deployed to the production site.
7. The production site is checked after deployment.

This means the public website only changes after the update has been reviewed.

## 5. Why This Is Better Than Sending HTML Files

Sending HTML files manually can work at the beginning, but it becomes messy over time.

Using GitHub and Vercel gives us:

- version history;
- easier collaboration;
- safer updates;
- test links before production;
- faster deployment;
- fewer lost files;
- easier rollback;
- a clear record of what changed.

If something breaks, we can go back to an earlier version instead of guessing which HTML file was the correct one.

## 6. Suggested Naming

For a guitar tool website, the structure could look like this:

```txt
GitHub repository:
guitar-tool-website

Production Vercel project:
guitar-tool

Test Vercel project:
guitar-tool-test

Production domain:
guitartool.com

Test domain:
test.guitartool.com
```

The custom domain is optional at the beginning. The site can start with a Vercel link and move to a custom domain later.

## 7. Simple Static HTML Sites

If the website is only HTML, CSS, and JavaScript, the setup can be very simple.

The repository may contain:

```txt
index.html
styles.css
script.js
assets/
```

Vercel can host this as a static website without needing a complicated backend.

If the site later needs saved data, user accounts, payments, or admin editing, then we can add backend services later.

## 8. Recommended Rule

Use GitHub first, then Vercel.

Use the test site first.

Only update the production website after the test site looks stable.

This keeps the main public website clean while still allowing fast iteration.

## 9. Official References

- Vercel deployment generated URLs: https://vercel.com/docs/concepts/deployments/generated-urls
- Vercel custom domains: https://vercel.com/docs/concepts/projects/domains/add-a-domain
- Vercel and GitHub deployments: https://docs.vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel
