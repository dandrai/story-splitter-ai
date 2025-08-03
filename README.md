# Story Splitter AI

An intelligent user story analysis and splitting tool powered by AI agents. This application helps agile teams write better user stories by providing real-time analysis, splitting suggestions, and collaborative editing features with Pusher integration for real-time updates.

![Story Splitter AI](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Pusher](https://img.shields.io/badge/realtime-Pusher-purple.svg)

## Features

- **Real-time Collaborative Editing**: Multiple users can edit stories simultaneously using Pusher
- **AI-Powered Analysis**: Four specialized AI agents provide insights:
  - **Story Analyst**: Evaluates stories against INVEST criteria
  - **Splitting Expert**: Suggests optimal story splits
  - **Coaching Assistant**: Provides improvement tips
  - **Quality Reviewer**: Assesses overall story quality
- **Story Mapping Board**: Visual organization of stories and epics
- **Import/Export**: Save and load your work
- **Auto-save**: Never lose your progress

## Tech Stack

- **Frontend**: React, Tailwind CSS, Pusher-js
- **Backend**: Node.js, Express, Pusher
- **AI Agents**: Modular agent system (ready for OpenAI/Claude integration)
- **Real-time**: Pusher Channels
- **Deployment**: Vercel-ready

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- Git
- Pusher account (free tier available at [pusher.com](https://pusher.com))

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/story-splitter-ai.git
cd story-splitter-ai
```

2. Install dependencies:
```bash
npm run install:all
```

3. Set up Pusher:
   - Create a free account at [pusher.com](https://pusher.com)
   - Create a new Channels app
   - Copy your app credentials

4. Create environment files:

Create `.env` in the root directory:
```bash
# Server Configuration
NODE_ENV=development
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000

# Pusher Configuration
PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_key
PUSHER_SECRET=your_secret
PUSHER_CLUSTER=your_cluster

# Optional: AI API Keys
# CLAUDE_API_KEY=your_claude_key
# OPENAI_API_KEY=your_openai_key
USE_MOCK_AI=true
```

Create `client/.env`:
```bash
REACT_APP_PUSHER_KEY=your_pusher_key
REACT_APP_PUSHER_CLUSTER=your_pusher_cluster
```

5. Start the development server:
```bash
npm run dev
```

6. Open http://localhost:3000 in your browser

## Project Structure

```
story-splitter-ai/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.js         # Main application
│   │   └── hooks/
│   │       └── usePusherCollaboration.js
│   └── public/
├── server/                 # Node.js backend
│   ├── index.js           # Express server with Pusher
│   ├── agents/            # AI agent implementations
│   └── utils/
│       ├── pusher-client.js
│       └── llm-client.js
├── api/                   # Vercel serverless functions
└── vercel.json           # Vercel configuration
```

## Deployment to Vercel

### Step 1: Prepare for Deployment

1. Push your code to GitHub
2. Ensure all environment variables are set

### Step 2: Deploy to Vercel

1. Sign in to [Vercel](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Add environment variables:
   - All variables from your `.env` file
   - Plus client variables: `REACT_APP_PUSHER_KEY`, `REACT_APP_PUSHER_CLUSTER`
5. Deploy!

### Step 3: Update CORS Settings

After deployment, update your `.env`:
```bash
ALLOWED_ORIGINS=http://localhost:3000,https://your-app.vercel.app
```

## Environment Variables

### Required:
- `PUSHER_APP_ID` - Your Pusher app ID
- `PUSHER_KEY` - Your Pusher key
- `PUSHER_SECRET` - Your Pusher secret
- `PUSHER_CLUSTER` - Your Pusher cluster
- `REACT_APP_PUSHER_KEY` - Same as PUSHER_KEY (for client)
- `REACT_APP_PUSHER_CLUSTER` - Same as PUSHER_CLUSTER (for client)

### Optional (for AI integration):
- `CLAUDE_API_KEY` - Anthropic Claude API key
- `OPENAI_API_KEY` - OpenAI API key
- `USE_MOCK_AI` - Set to `true` to use mock responses

## Usage

### Story Editor

1. Enter your user story in the editor
2. Use the format: "As a [user], I can [action] so that [benefit]"
3. Stories auto-save as you type
4. Click "Publish" to save a version

### AI Agents

Click any AI agent button to analyze your story:
- **Story Analyst**: Get INVEST criteria assessment
- **Splitting Expert**: Receive story splitting suggestions
- **Coaching Assistant**: Get writing tips
- **Quality Reviewer**: Check overall quality

### Story Mapping Board

1. Switch to Board view
2. Create epics to organize stories
3. Drag and drop stories between epics
4. Add new stories directly to epics

### Real-time Collaboration

- See other users editing in real-time
- Typing indicators show who's working
- Changes sync automatically via Pusher

## Troubleshooting

### Pusher Connection Issues

1. Verify your Pusher credentials are correct
2. Check the Pusher debug console at pusher.com
3. Ensure CORS is properly configured

### AI Agents Not Working

1. Check if `USE_MOCK_AI=true` for testing
2. Verify API keys if using real AI
3. Check server logs for errors

### Deployment Issues

1. Ensure all environment variables are set in Vercel
2. Check Vercel function logs
3. Verify build output in Vercel dashboard

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Real-time powered by [Pusher](https://pusher.com)
- Built with React and Node.js
- AI agent architecture for extensibility
- Deployed on [Vercel](https://vercel.com)

## Support

For issues and feature requests, please use the [GitHub issues](https://github.com/YOUR_USERNAME/story-splitter-ai/issues) page.

---

Made with ❤️ by the Story Splitter AI team
