# Shadow Sprint
My final project of NTNU_Computer_Graphics!

---

## Introduction

**Shadow Sprint** is a 3D endless runner game inspired by classic titles like Subway Surfers and Temple Run, developed entirely with JavaScript and WebGL.  
Guide your robot through three fast-moving lanes, collect coins, dodge speeding trains, and see how far you can go!

---

## Gameplay

- **Move left and right** with the arrow keys to switch between lanes.
- **Collect coins** to increase your coin count and score.
- **Avoid incoming trains**—hitting a train ends the game.
- **Switch camera perspectives** with the 'V' key:  
  - Third-person: follow your character from behind  
  - First-person: see from the robot's point of view

- The longer you survive, the faster the trains spawn, increasing the difficulty.

---

## Features

- Real-time **3D graphics and animation** with WebGL
- **Phong lighting** for realistic highlights and shiny spinning coins
- **Dynamic reflections**: see your character and coins mirrored on the ground
- **Textured tracks** and a skybox background for an immersive scene
- **Responsive UI** showing score, coins, and camera mode
- **Smooth animations** using `requestAnimationFrame`
- **Audio effects**: background music and sound cues for coins and game over

---

## Controls

| Key             | Action                         |
|-----------------|-------------------------------|
| `←` / `→`       | Move left / right              |
| `V`             | Switch camera view             |
| `Enter` / Button| Start or restart the game      |

---

## Technical Highlights

- All 3D models are generated in JavaScript (no external assets)
- Custom shaders written in GLSL for lighting and texturing
- Collision detection using axis-aligned bounding boxes (AABB)
- Dynamic object spawning and animation control

---

## How to Run

1. Download or clone this repository.
2. Open `index.html` in your web browser (recommended: latest Chrome/Firefox).
3. **No additional setup required!**
4. Enjoy playing Shadow Sprint.

> **Note:** For full audio and texture support, please use a local server or adjust browser security settings.

---

## 📚 Credits

- Developed by [Roku](https://github.com/EnLiao)
- Final project for NTNU Computer Graphics, Spring 2025

---

## 📃 License

This project is for educational and demonstration purposes.