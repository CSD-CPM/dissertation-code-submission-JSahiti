# Grade Assist
[![License: Academic](https://img.shields.io/badge/License-Academic-blue.svg)](https://opensource.org/licenses/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18.x-blue)](https://reactjs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-orange)](https://www.mysql.com/)

An instructor-oriented web app that automates peer-evaluation grade computation for group projects. Import TEAMMATES-style CSVs, set **PA weight** and **penalties**, enter **Group Marks**, and get per-student **Final Marks** with clear breakdowns.

## Table of Contents
- [About the Project](#about-the-project)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Data Flow](#data-flow)
- [Prerequisites](#prerequisites)
- [Local Installation](#local-installation)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Folder Structure](#folder-structure)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)
- [Contact](#contact)

## About the Project
**Grade Assist** reduces manual work and errors when calculating grades from peer-assessment data. It is an instructor-oriented web app that automates peer-evaluation grade computation for group projects.

## Key Features
- **CSV Ingest (TEAMMATES format)** with preview & validation  
- **Configurable grading**: PA Weight (%), Number of Criteria, Penalty (%)  
- **Group Mark entry** per team with inline, scrollable editor  
- **Automatic calculations**  
  - Average Points → PA Score → Weighted Mark → Individual Mark → Final Mark  
- **Status & KPIs**: teams, students, PA not-submitted count  
- **Export**: one-click CSV export of the Grade Breakdown  
- **Auth flows**: Register, Login, Forgot/Reset Password (JWT cookie)

## Architecture

### Backend (`/src`)
- **Framework**: Node.js + Express  
- **Database**: MySQL (mysql2 / pool)  
- **Auth**: JWT (http-only cookies)  
- **Upload**: Multer for CSV  
- **Validation**: Checks server-side  
- **Env/Config**: `dotenv`

### Frontend (`/client`)
- **Framework**: React 18 (SPA)  
- **State/UI**: React + CSS  
- **CSV Export**: client-side Blob download  
- **Routing**: react-router

## Data Flow
1. Upload & Preview CSV  
2. Configure PA Weight, Criteria, Penalty  
3. Server parses, stores the session and aggregates  
4. Instructor enters Group Marks  
5. Computed results returned per student  
6. Optional export of final grades  

## Prerequisites
- Node.js 18+  
- MySQL 8+
- React 18
- (Optional) Mailtrap/Auth SMTP for password resets  

## Local Installation
```bash
git clone <your-repo-url>
cd <project-root>
npm install
cd client && npm install && cd ..
cp .env.example .env
npm run dev
