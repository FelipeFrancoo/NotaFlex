# Invoice Processing System

## Overview

This is a full-stack web application for processing and analyzing CSV invoice data. The system allows users to upload CSV files containing invoice information, processes the data to generate summaries by branch and daily totals, and provides Excel export functionality. Built with a modern React frontend using shadcn/ui components and an Express.js backend with PostgreSQL database integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Library**: shadcn/ui components built on top of Radix UI primitives
- **Styling**: Tailwind CSS with custom design system using CSS variables
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation resolvers

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **File Processing**: Multer for file uploads, PapaCSV for CSV parsing, ExcelJS for Excel generation
- **Development**: Custom Vite integration for hot module replacement in development
- **Error Handling**: Centralized error handling middleware with structured error responses

### Data Storage Solutions
- **Primary Database**: PostgreSQL accessed through Neon serverless driver
- **ORM**: Drizzle ORM with schema-first approach and automatic migrations
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **File Storage**: In-memory processing with temporary file handling via multer

### Database Schema Design
The system uses three main entities:
- **Invoices**: Individual invoice records with branch, number, date, value, and week boundaries
- **Branch Summaries**: Aggregated data by branch including count and total values per week
- **Daily Summaries**: Daily aggregations with day-of-week tracking and totals

### API Structure
- **RESTful Design**: Standard HTTP methods with JSON responses
- **File Upload Endpoint**: Multipart form data handling for CSV uploads
- **Data Export**: Binary file downloads for Excel generation
- **Error Responses**: Consistent error format with status codes and messages

### Data Processing Pipeline
- **CSV Parsing**: Flexible date format handling for Brazilian locale (DD/MM/YYYY)
- **Week Calculation**: Automatic week boundary detection and assignment
- **Aggregation Logic**: Real-time calculation of branch totals and daily summaries
- **Memory Storage**: In-memory data structure with Map-based storage for development

## External Dependencies

### Database Services
- **Neon**: Serverless PostgreSQL database hosting
- **Drizzle Kit**: Database migration and schema management tools

### UI and Styling
- **Radix UI**: Comprehensive set of low-level UI primitives for accessibility
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **Lucide React**: Icon library with consistent design language

### Development Tools
- **Vite**: Fast build tool with hot module replacement
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Fast JavaScript bundler for production builds

### File Processing
- **Multer**: Node.js middleware for handling multipart/form-data file uploads
- **PapaCSV**: Robust CSV parsing library with flexible configuration
- **ExcelJS**: Excel file generation with formatting and styling capabilities

### State Management
- **TanStack Query**: Server state synchronization with caching and background updates
- **React Hook Form**: Performant form handling with minimal re-renders

### Replit Integration
- **Replit Vite Plugins**: Development environment integration with error overlay and cartographer
- **Replit Banner**: Development mode identification when accessed outside Replit