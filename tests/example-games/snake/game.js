import {
  Transform,
  GameBuilder,
  Query,
  EventBus,
  GlobalState,
  zodV4 as z
} from '../game-engine.es.js'

const gameBuilder = new GameBuilder()

// URL Parameter Configuration
const urlParams = new URLSearchParams(window.location.search)
const testMode = urlParams.get('testMode') === 'true'
const pauseMode = urlParams.get('pauseMode') === 'true'
const speedMultiplier = parseFloat(urlParams.get('speed') || (testMode ? '0.1' : '1.0'))

const BASE_MOVE_INTERVAL_MS = 500
const MOVE_INTERVAL_MS = BASE_MOVE_INTERVAL_MS / speedMultiplier
const INITIAL_BODY_LENGTH = 3
const PLAY_AREA = { minX: 1, maxX: 19, minY: 1, maxY: 19 }
const MAX_BODY_LENGTH = 100

console.log('🐍 Snake Configuration:', { 
  testMode, 
  pauseMode,
  speedMultiplier, 
  moveIntervalMs: MOVE_INTERVAL_MS 
})

const INIT_GLOBAL_STATE = {
  score: 0,
  direction: 'right',
  nextDirection: 'right',
  timeSinceLastMove: 0, // Milliseconds since last move
  bodyLength: INITIAL_BODY_LENGTH,
  isPaused: pauseMode // Start paused if pauseMode=true in URL
}

GlobalState.set(INIT_GLOBAL_STATE)

// Expose pause/resume functions for testing framework
window.gamePause = () => {
  GlobalState.set({ isPaused: true })
  console.log('🐍 Game PAUSED')
}

window.gameResume = () => {
  GlobalState.set({ isPaused: false })
  console.log('🐍 Game RESUMED')
}

gameBuilder.createAxis2D('Move')
  .bindWASD()
  .bindArrowKeys()
  .bindVirtualDPad('#dpad')

function dirToVector(dir) {
  switch (dir) {
    case 'up': return { x: 0, y: 1 } // +Y is up in world space
    case 'down': return { x: 0, y: -1 } 
    case 'left': return { x: -1, y: 0 }
    case 'right': return { x: 1, y: 0 }
  }
}

// Custom components
const Food = gameBuilder.defineComponent('Food', z.object({}))
const SnakeBody = gameBuilder.defineComponent('SnakeBody', z.object({
  index: z.int32()
}))

const foodQuery = new Query().with(Food).with(Transform)
const bodySegmentQuery = new Query().with(SnakeBody)

let bodySegmentQueue = []

function syncBodySegmentOrder() {
  for (let i = 0; i < bodySegmentQueue.length; i++) {
    const segmentEid = bodySegmentQueue[i]
    if (segmentEid !== undefined) {
      SnakeBody.assign(segmentEid, { index: i })
    }
  }
}

function syncBodyLength() {
  GlobalState.set({ bodyLength: bodySegmentQueue.length + 1 })
}

function isPositionOccupied(scene, x, y) {
  const headEid = scene.getEntityByName('SnakeHead')
  if (headEid !== undefined) {
    const headTransform = Transform.read(headEid)
    if (Math.round(headTransform.x) === x && Math.round(headTransform.y) === y) {
      return true
    }
  }
  
  const segments = scene.query(bodySegmentQuery)
  for (const eid of segments) {
    const transform = Transform.read(eid)
    if (Math.round(transform.x) === x && Math.round(transform.y) === y) {
      return true
    }
  }
  
  return false
}

function spawnFood(scene) {
  const foodEids = scene.query(foodQuery)
  if (foodEids.length === 0) return
  
  const foodEid = foodEids[0]
  
  let x, y
  let attempts = 0
  do {
    x = Math.floor(Math.random() * (PLAY_AREA.maxX - PLAY_AREA.minX + 1)) + PLAY_AREA.minX
    y = Math.floor(Math.random() * (PLAY_AREA.maxY - PLAY_AREA.minY + 1)) + PLAY_AREA.minY
    attempts++
  } while (isPositionOccupied(scene, x, y) && attempts < 100)
  
  Transform.assign(foodEid, { x, y })
}

function resetGame(scene) {
  // Clear existing body segments
  const segments = scene.query(bodySegmentQuery)
  for (const eid of segments) 
    scene.removeEntity(eid)
  bodySegmentQueue = []
  
  // Reset snake head position
  const headEid = scene.getEntityByName('SnakeHead')
  if (headEid === undefined) return
  
  Transform.assign(headEid, { x: 10, y: 10 })
  
  GlobalState.set(INIT_GLOBAL_STATE)
  
  // Create initial body segments (snake starts at x=10, y=10, moving right)
  // Body segment indices: 0 = right behind head, 1 = next, etc.
  for (let i = 0; i < INITIAL_BODY_LENGTH - 1; i++) {
    const [segmentEid] = scene.instantiateTemplate('SnakeSegment', {
      x: 10 - (i + 1), // Behind the head
      y: 10,
      index: i
    })

    if (segmentEid !== undefined) bodySegmentQueue.push(segmentEid)
  }

  syncBodySegmentOrder()
  syncBodyLength()
  
  spawnFood(scene)
}

gameBuilder.onSceneInit((scene) => {
  if (scene.name !== 'GameWorld') return
  
  resetGame(scene)
  
  EventBus.on('game:restart', () => {
    resetGame(scene)
  })
})

const gameLogicSystem = (scene, delta) => {
  const inputManager = scene.inputManager
  const headEid = scene.getEntityByName('SnakeHead')
  
  if (headEid === undefined) return
  
  const headTransform = Transform.read(headEid)
  
  const isPaused = GlobalState.get('isPaused')
  if (isPaused) {
    return // Skip all game logic when paused
  }

  let direction = GlobalState.get('direction')
  let nextDirection = GlobalState.get('nextDirection')
  let timeSinceLastMove = GlobalState.get('timeSinceLastMove')
  
  const move = inputManager.getAxis2D('Move')
  
  if (Math.abs(move.x) > 0.1 || Math.abs(move.y) > 0.1) {
    let newDirection = nextDirection
    
    if (Math.abs(move.x) > Math.abs(move.y)) {
      newDirection = move.x > 0 ? 'right' : 'left'
    } else {
      newDirection = move.y > 0 ? 'up' : 'down'
    }
    
    // Prevent 180° turns
    const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' }
    if (newDirection !== opposites[direction]) {
      nextDirection = newDirection
      GlobalState.set({ nextDirection })
    }
  }
  
  timeSinceLastMove += delta
  GlobalState.set({ timeSinceLastMove })
  
  // Only move when timer threshold reached
  if (timeSinceLastMove >= MOVE_INTERVAL_MS) {
    GlobalState.set({ timeSinceLastMove: timeSinceLastMove - MOVE_INTERVAL_MS })
    
    direction = nextDirection
    GlobalState.set({ direction })
    
    const { x: dx, y: dy} = dirToVector(direction)
    const newHeadX = Math.round(headTransform.x + dx)
    const newHeadY = Math.round(headTransform.y + dy)
    
    // Wall collision check
    if (newHeadX < PLAY_AREA.minX || newHeadX > PLAY_AREA.maxX ||
        newHeadY < PLAY_AREA.minY || newHeadY > PLAY_AREA.maxY) {
      pushScene('GameOver')
      return
    }
    
    // Self collision check - check if new head position hits any body segment
    const segments = scene.query(bodySegmentQuery)
    for (const segEid of segments) {
      const segTransform = Transform.read(segEid)
      if (Math.round(segTransform.x) === newHeadX && Math.round(segTransform.y) === newHeadY) {
        pushScene('GameOver')
        return
      }
    }
    
    // Food collision check
    const foodEids = scene.query(foodQuery)
    let foodCollected = false
    
    if (foodEids.length > 0) {
      const foodEid = foodEids[0]
      const foodTransform = Transform.read(foodEid)
      
      if (newHeadX === foodTransform.x && newHeadY === foodTransform.y) {
        foodCollected = true
        const currentScore = GlobalState.get('score') ?? 0
        GlobalState.set({ score: currentScore + 1 })
      }
    }
    
    const segmentCount = bodySegmentQueue.length
    const currentBodyLength = segmentCount + 1
    
    // Store old head position (this becomes the new segment behind the head)
    const oldHeadX = Math.round(headTransform.x)
    const oldHeadY = Math.round(headTransform.y)
    
    if (foodCollected && currentBodyLength < MAX_BODY_LENGTH) {
      // Growing: spawn new segment at old head position
      const [newSegmentEid] = scene.instantiateTemplate('SnakeSegment', {
        x: oldHeadX,
        y: oldHeadY,
        index: segmentCount
      })

      if (newSegmentEid !== undefined) {
        bodySegmentQueue.unshift(newSegmentEid)
        syncBodySegmentOrder()
        syncBodyLength()
      }
      
      spawnFood(scene)
    } else if (segmentCount > 0) {
      // Normal movement: reuse tail segment as new segment behind head
      const tailEid = bodySegmentQueue.pop()
      
      if (tailEid !== undefined) {
        Transform.assign(tailEid, {
          x: oldHeadX,
          y: oldHeadY
        })

        bodySegmentQueue.unshift(tailEid)
        syncBodySegmentOrder()
      }
    }
    
    Transform.assign(headEid, {
      x: newHeadX,
      y: newHeadY
    })
  }
}

const xml = await fetch('./game.xml').then(res => res.text())

gameBuilder
  .addSystem(gameLogicSystem)
  .runWithXML(xml)
