# Grade Assist
[![License: Academic](https://img.shields.io/badge/License-Academic-blue.svg)](https://opensource.org/licenses/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18.x-blue)](https://reactjs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-orange)](https://www.mysql.com/)

An instructor-oriented web application that automates peer-evaluation grade computation for group projects.  
Import TEAMMATES-style CSVs, configure grading parameters (PA weight, penalties, criteria), and obtain per-student **Final Marks** with transparent breakdowns.

---

## Table of Contents
- [About the Project](#about-the-project)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Data Flow](#data-flow)
- [Prerequisites](#prerequisites)
- [Local Installation & Setup](#local-installation--setup)
- [API Documentation](#api-documentation)
- [Folder Structure](#folder-structure)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## About the Project
**Grade Assist** minimizes manual work and errors when computing grades from peer-assessment data.  
It is an instructor-oriented web tool designed to automate the grade calculation process for group projects — focusing on fairness, transparency, and instructor usability.

---

## Key Features
- **CSV Upload (TEAMMATES format)** with preview and validation  
- **Configurable grading settings**:  
  - PA Weight (%)  
  - Number of Criteria  
  - Penalty (%)  
- **Group Mark entry** per team with inline editing  
- **Automatic computation**  
  - Average Points → PA Score → Weighted Mark → Individual Mark → Final Mark  
- **Statistics & KPIs:** teams, students, missing PA submissions  
- **CSV Export** of final grade breakdown  
- **Auth Flows:** Register, Login, Forgot/Reset Password (JWT cookies)

---

## Architecture

### Backend (`/server`)
- **Framework:** Node.js + Express  
- **Database:** MySQL (mysql2 / connection pool)  
- **Authentication:** JWT (HTTP-only cookies)  
- **File Upload:** Multer for CSVs  
- **Validation:** Server-side checks  
- **Environment Configuration:** dotenv

### Frontend (`/client`)
- **Framework:** React 18 (SPA)  
- **State/UI:** React + CSS  
- **CSV Export:** Blob-based download  
- **Routing:** React Router v6  

---

## Data Flow
1. Upload & preview CSV  
2. Configure PA Weight, Criteria, and Penalty  
3. Server parses and stores session data  
4. Instructor enters Group Marks  
5. System computes and returns individual results  
6. Grades can be exported as CSV  

---

## Prerequisites
- **Node.js** ≥ 18  
- **MySQL** ≥ 8  
- **React** ≥ 18  
- (Optional) **Mailtrap/Auth SMTP** for password reset testing  

---

## Local Installation & Setup

Follow these steps to run **Grade Assist** locally.

```bash
#  Clone the repository
git clone https://github.com/CSD-CPM/dissertation-code-submission-JSahiti.git

#  Navigate into the project root
cd dissertation-code-submission-JSahiti

#  Install backend (server) dependencies
cd server
npm install

# Create your environment file from the example
cp .env.example .env
```

Now open `server/.env` in your editor and update the configuration values for your local setup:

```bash
# Install frontend (client) dependencies
cd ../client
npm install

#  Start the frontend and backend
# (Run these in separate terminals)
npm start                     # React frontend → http://localhost:3001
cd ../server && npm run dev   # Node backend → http://localhost:3000
```

**After setup:**
- Open **http://localhost:3001** in your browser.  
- Make sure MySQL is running and credentials in `.env` are correct.  
- The app will automatically connect to your configured database.

---

## Usage
- Log in or register as an instructor.  
- Upload your peer-evaluation CSV file.  
- Configure PA weight, criteria, and penalty values.  
- Enter group marks and view automatically computed results.  
- Export the final grade breakdown as a CSV file.  

---

## API Documentation
| Category | Endpoint | Method | Description |
|-----------|-----------|--------|-------------|
| **Health** | `/health` | GET | Checks database and server status |
| **Auth** | `/auth/register` | POST | Register a new instructor account |
|  | `/auth/login` | POST | Log in and obtain JWT cookie |
|  | `/auth/me` | GET | Fetch current logged-in user info |
|  | `/auth/logout` | POST | Log out and clear cookie |
|  | `/auth/forgot` | POST | Request password reset email |
|  | `/auth/reset` | POST | Reset password using token |
| **Upload** | `/upload` | POST | Upload and validate TEAMMATES-style CSV |
| **Grades** | `/api/grade-breakdown` | GET | Retrieve computed grade breakdown |
|  | `/api/group-marks` | POST | Add or update group marks |
| **Debug / Dev** | `/__debug/routes` | GET | List all registered API routes |

---

## Folder Structure
```
dissertation-code-submission-JSahiti/
│
├── client/                  # React frontend
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── server/                  # Node.js backend
│   ├── src/
│   ├── .env.example
│   ├── package.json
│   └── ...
│
├── .gitignore
└── README.md
```

---

## License
This project is licensed for **academic and educational use** only.  
Not authorized for commercial redistribution.

---

## Acknowledgments
- [TEAMMATES](https://teammatesv4.appspot.com) for CSV schema inspiration  
- [React](https://reactjs.org/) and [Node.js](https://nodejs.org/) communities  
- [Mailtrap](https://mailtrap.io) for email testing tools  

---


