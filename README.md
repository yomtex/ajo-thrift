Ajo Thrift

Ajo Thrift is a community-based savings and investment platform that allows users to create, join, and manage group savings circles (Ajo/Thrift). It provides real-time communication, member management, and contribution tracking for an efficient and transparent group savings experience.

Features

User Authentication: Secure login/signup using Supabase.

Group Management: Create, view, and manage groups.

Join Requests: Approve or reject member requests (for group creators).

Member Dashboard: Track contributions, payout positions, and group status.

Real-time Chat: Integrated chat module for group members.

Financial Overview: Track contributions, frequency, target amounts, and current participants.

Responsive Design: Mobile-first and fully responsive UI using Tailwind CSS and Radix UI.

Technologies Used

Frontend: React, TypeScript, Tailwind CSS

UI Components: Radix UI, Lucide Icons

Backend / Database: Supabase (PostgreSQL)

State Management & Server Data: React Query (TanStack Query)

Notifications: Custom toast notifications

Screenshots & Demo
Group Overview


Displays group name, status, contribution amount, frequency, current participants, and target amount.

Members Tab


Shows all current members along with join date and payout position.

Join Requests Tab


Group creators can approve or reject pending join requests.

Chat Module


Allows real-time messaging between group members.

Architecture & Flow
flowchart TD
    A[User] -->|Sign Up / Login| B[Supabase Auth]
    B --> C[Dashboard]
    C --> D[View Available Groups]
    C --> E[Create Group]
    D --> F[Send Join Request]
    E --> G[Group Overview]
    G --> H[Approve / Reject Requests]
    G --> I[Member List]
    G --> J[Group Chat]
    F --> H


Users authenticate via Supabase Auth.

They can view available groups or create their own.

Join requests are managed by the group creator.

Members interact via chat and track contributions.

Getting Started
Prerequisites

Node.js (v18+)

npm or yarn

Supabase project for database and authentication

Installation

Clone the repository:

git clone https://github.com/your-username/ajo-thrift.git
cd ajo-thrift


Install dependencies:

npm install
# or
yarn install


Setup environment variables:

Create a .env.local file:

NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key


Run the development server:

npm run dev
# or
yarn dev


Visit http://localhost:3000
 to access the app.

Project Structure
/src
 ├─ /components       # UI components (Cards, Buttons, Dialogs)
 ├─ /hooks            # Custom hooks (useAuth, useToast)
 ├─ /integrations     # Supabase client & integrations
 ├─ /pages            # Next.js pages
 ├─ /services         # API & Supabase queries/mutations
 └─ /types            # TypeScript types and interfaces

Usage

Create Group: Enter group details such as name, contribution amount, and frequency.

Join Group: Browse available groups and send a join request.

Approve Requests: Group creators can approve/reject pending requests.

Contribute: Track and contribute to group savings.

Chat: Use the chat feature for communication between members.

Contributing

Fork the repository

Create a new branch: git checkout -b feature/your-feature

Make your changes

Commit your changes: git commit -m "Add feature"

Push to the branch: git push origin feature/your-feature

Open a Pull Request

License

This project is licensed under the MIT License.

Contact

Email: ganiutoyeeb31@gmail.com

GitHub: https://github.com/yomtex

This README now includes:

Features

Tech stack

Screenshots & demo

Architecture flowchart

Installation & usage

Contribution guide

License & contact info