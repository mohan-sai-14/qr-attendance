# TU Robotics Club Attendance System

A modern web application for QR code-based attendance management specifically designed for the Takshashila University Robotics Club.

## Features

- **Dual Login System**: Separate interfaces for students and administrators
- **QR Code Attendance**: Generate and scan QR codes for marking attendance
- **Real-time Tracking**: Monitor attendance in real-time
- **Modern UI/UX**: Responsive design with dark/light mode support
- **Glassmorphism Effects**: Modern UI with beautiful glass-like components
- **Animations**: Smooth transitions and animations for better user experience

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm run dev
   ```

## Logo Setup

For proper branding, you need to set up the TU Robotics Club logo:

1. Add the following files to the `app/client/public/` directory:
   - `robotics-logo.png` - Primary logo image
   - `robotics-logo.svg` - SVG fallback (already provided)

2. For detailed instructions, see the [logo setup guide](app/client/public/logo-instructions.md)

## Tech Stack

- **Frontend**: React with TypeScript
- **UI Components**: Custom components with Radix UI
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **QR Code Handling**: QRCode.react and HTML5-QRCode
- **Data Management**: React Query

## Project Structure

- `/app/client/src` - Frontend source code
  - `/components` - Reusable UI components
  - `/pages` - Page components
  - `/lib` - Utilities and helpers
  - `/hooks` - Custom React hooks
  - `/context` - Context providers

## Customization

The application supports various customization options:

- **Theme**: Toggle between light and dark mode
- **Colors**: Edit the theme in `app/client/src/styles/globals.css`
- **Components**: Modify components in the `app/client/src/components` directory

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License. 