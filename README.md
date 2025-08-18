# Memory Card Game

This project is a simple matching card game built with React and TypeScript using Vite. The game allows players to match pairs of cards by flipping them over. The images on the cards are randomized at the start of each game, and players can customize the game by providing their own images and settings.

## Project Structure

The project is organized as follows:

```
memory-card-game
├── src
│   ├── components
│   │   ├── Card.tsx          # Represents an individual card in the game
│   │   ├── GameBoard.tsx     # Renders the grid of cards and manages game logic
│   │   └── GameControls.tsx   # Provides controls for starting a new game
│   ├── hooks
│   │   └── useMemoryGame.ts   # Custom hook for managing game state and logic
│   ├── types
│   │   └── index.ts           # TypeScript types and interfaces
│   ├── utils
│   │   └── gameUtils.ts       # Utility functions for shuffling cards and generating game state
│   ├── styles
│   │   └── game.css           # CSS styles for the game
│   ├── App.tsx                # Main component of the application
│   └── main.tsx               # Entry point of the application
├── public
│   ├── images
│   │   └── placeholder.jpg     # Placeholder image for cards
│   └── logo.png               # Logo image displayed on the back of the cards
├── gameConfig.json            # Initial configuration for the game
├── package.json               # npm configuration file
├── tsconfig.json              # TypeScript configuration file
└── README.md                  # Documentation for the project
```

## Getting Started

To get started with the Memory Card Game, follow these steps:

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd memory-card-game
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Run the development server:**
   ```
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000` to see the game in action.

## Game Rules

- The game consists of a grid of cards, each with an image on one side and a logo on the other.
- Players take turns flipping over two cards at a time, trying to find matching pairs.
- If a player finds a match, the cards remain face up. If not, they are flipped back over.
- The game ends when all pairs have been matched.

## Customization

You can customize the game by modifying the `gameConfig.json` file. This file allows you to specify:

- The images to be used for the cards.
- The background color of the game.
- The logo displayed on the back of the cards.

## Best Practices

- The project follows the DRY (Don't Repeat Yourself) principle, ensuring clean and maintainable code.
- Functional programming concepts are used throughout the application to manage state and logic.

Enjoy playing the Memory Card Game!