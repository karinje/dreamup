import {
  Transform,
  GameBuilder,
  Query,
  EventBus,
  GlobalState,
  zodV4 as z
} from '../game-engine.es.js'

// URL Parameter Configuration
const urlParams = new URLSearchParams(window.location.search)
const testMode = urlParams.get('testMode') === 'true'
const pauseMode = urlParams.get('pauseMode') === 'true'
const speedMultiplier = parseFloat(urlParams.get('speed') || (testMode ? '0.1' : '1.0'))

const FIELD = { minX: -1.5, maxX: 21.5, minY: 1, maxY: 19 }
const CENTER = { x: (FIELD.minX + FIELD.maxX) / 2, y: 10 }
const PADDLE_HALF_HEIGHT = 1.5
const PADDLE_HALF_WIDTH = 0.3
const BALL_RADIUS = 0.35
const BASE_BALL_SPEED = 9 * speedMultiplier
const MAX_BALL_SPEED = 20 * speedMultiplier
const BALL_SPEED_INCREMENT = 1.07
const MAX_RETURN_ANGLE = 0.7 // Radians (~40°)
const WIN_SCORE = 7

console.log('🏓 Pong Configuration:', { 
  testMode,
  pauseMode,
  speedMultiplier, 
  baseBallSpeed: BASE_BALL_SPEED,
  maxBallSpeed: MAX_BALL_SPEED
})

const gameBuilder = new GameBuilder()

gameBuilder.createAxis('RightPaddleVertical')
  .bindKeys('ArrowDown', 'ArrowUp')

gameBuilder.createAction('Pause')
  .bindKey('Escape')

const Paddle = gameBuilder.defineComponent('Paddle', z.object({
  side: z.enum(['left', 'right']),
  speed: z.float32()
}))

const Ball = gameBuilder.defineComponent('Ball', z.object({
  velocityX: z.float32(),
  velocityY: z.float32(),
  speed: z.float32()
}))

const paddleQuery = new Query().with(Paddle).with(Transform)
const ballQuery = new Query().with(Ball).with(Transform)

const INIT_GLOBAL_STATE = {
  leftScore: 0,
  rightScore: 0,
  serveDirection: 1,
  matchWinner: null,
  roundActive: false,
  isPaused: pauseMode // Start paused if pauseMode=true in URL
}

GlobalState.set(INIT_GLOBAL_STATE)

// Expose pause/resume functions for testing framework
window.gamePause = () => {
  GlobalState.set({ isPaused: true })
  console.log('🏓 Game PAUSED')
}

window.gameResume = () => {
  GlobalState.set({ isPaused: false })
  console.log('🏓 Game RESUMED')
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const getPaddleEid = (scene, name) => scene.getEntityByName(name)

function centerPaddles(scene) {
  const leftEid = getPaddleEid(scene, 'LeftPaddle')
  if (leftEid !== undefined) Transform.assign(leftEid, { y: CENTER.y })

  const rightEid = getPaddleEid(scene, 'RightPaddle')
  if (rightEid !== undefined) Transform.assign(rightEid, { y: CENTER.y })
}

function randomServeAngle() {
  return (Math.random() * (MAX_RETURN_ANGLE * 2)) - MAX_RETURN_ANGLE
}

function serveBall(scene, direction) {
  const ballEid = scene.getEntityByName('Ball')
  if (ballEid === undefined) return

  const angle = randomServeAngle()
  const speed = BASE_BALL_SPEED
  const velocityX = Math.cos(angle) * speed * direction
  const velocityY = Math.sin(angle) * speed

  Transform.assign(ballEid, { x: CENTER.x, y: CENTER.y })
  Ball.assign(ballEid, { velocityX, velocityY, speed })
  GlobalState.set({ roundActive: true, serveDirection: direction })
}

function stopBall(scene) {
  const ballEid = scene.getEntityByName('Ball')
  if (ballEid === undefined) return
  Ball.assign(ballEid, { velocityX: 0, velocityY: 0, speed: 0 })
  Transform.assign(ballEid, { x: CENTER.x, y: CENTER.y })
}

function announceWinner(scene, side) {
  GlobalState.set({ matchWinner: side, roundActive: false })
  stopBall(scene)
  pushScene('GameOver')
}

function updateScore(scene, scoringSide) {
  const leftScore = GlobalState.get('leftScore') ?? 0
  const rightScore = GlobalState.get('rightScore') ?? 0

  const nextScores = scoringSide === 'left'
    ? { leftScore: leftScore + 1, rightScore }
    : { leftScore, rightScore: rightScore + 1 }

  GlobalState.set({ ...nextScores, roundActive: false })

  if (nextScores.leftScore >= WIN_SCORE || nextScores.rightScore >= WIN_SCORE) {
    const winner = nextScores.leftScore >= WIN_SCORE ? 'left' : 'right'
    announceWinner(scene, winner)
    return
  }

  const nextDirection = scoringSide === 'left' ? 1 : -1
  serveBall(scene, nextDirection)
}

const activeSceneRef = { scene: null }

function resetMatch(scene) {
  GlobalState.set({
    leftScore: 0,
    rightScore: 0,
    serveDirection: Math.random() < 0.5 ? -1 : 1,
    matchWinner: null,
    roundActive: false
  })

  centerPaddles(scene)
  serveBall(scene, GlobalState.get('serveDirection'))
}

gameBuilder.onSceneInit((scene) => {
  if (scene.name !== 'GameWorld') return

  activeSceneRef.scene = scene

  if (!activeSceneRef.restartListenerAttached) {
    EventBus.on('game:restart-match', () => {
      if (activeSceneRef.scene) resetMatch(activeSceneRef.scene)
    })
    activeSceneRef.restartListenerAttached = true
  }

  resetMatch(scene)
})

const gameSystem = (scene, delta) => {
  if (scene.name !== 'GameWorld') return

  const isPaused = GlobalState.get('isPaused')
  if (isPaused) {
    return // Skip all game logic when paused
  }

  const inputManager = scene.inputManager

  if (inputManager.isActionPressed('Pause')) {
    pushScene('PauseMenu')
    return
  }

  const dt = delta / 1000
  const roundActive = GlobalState.get('roundActive')

  const [ballEid] = scene.query(ballQuery)
  const ballTransform = ballEid !== undefined ? Transform.read(ballEid) : null
  const ballData = ballEid !== undefined ? Ball.read(ballEid) : null

  for (const eid of scene.query(paddleQuery)) {
    const paddle = Paddle.read(eid)
    const transform = Transform.read(eid)
    if (paddle.side === 'left') {
      if (ballTransform) {
        const tracking = roundActive && ballData !== null && ballData.velocityX < 0
        const targetY = tracking ? ballTransform.y : CENTER.y
        const diff = targetY - transform.y
        if (Math.abs(diff) > 0.05) {
          const speedMultiplier = tracking ? 1 : 0.65
          const maxStep = paddle.speed * speedMultiplier * dt
          const step = Math.sign(diff) * Math.min(Math.abs(diff), maxStep)
          const nextY = transform.y + step
          const clampedY = clamp(nextY, FIELD.minY + PADDLE_HALF_HEIGHT, FIELD.maxY - PADDLE_HALF_HEIGHT)
          Transform.assign(eid, { y: clampedY })
        }
      }
      continue
    }

    const axis = inputManager.getAxis('RightPaddleVertical')

    if (Math.abs(axis) > 0.01) {
      const nextY = transform.y + axis * paddle.speed * dt
      const clampedY = clamp(nextY, FIELD.minY + PADDLE_HALF_HEIGHT, FIELD.maxY - PADDLE_HALF_HEIGHT)
      Transform.assign(eid, { y: clampedY })
    }
  }

  if (!roundActive || ballEid === undefined || ballTransform === null || ballData === null) return

  let vx = ballData.velocityX
  let vy = ballData.velocityY
  let speed = ballData.speed > 0 ? ballData.speed : BASE_BALL_SPEED

  let nextX = ballTransform.x + vx * dt
  let nextY = ballTransform.y + vy * dt

  if (nextY + BALL_RADIUS > FIELD.maxY) {
    nextY = FIELD.maxY - BALL_RADIUS
    vy = -Math.abs(vy)
  } else if (nextY - BALL_RADIUS < FIELD.minY) {
    nextY = FIELD.minY + BALL_RADIUS
    vy = Math.abs(vy)
  }

  const leftPaddleEid = getPaddleEid(scene, 'LeftPaddle')
  if (leftPaddleEid !== undefined && vx < 0) {
    const leftTransform = Transform.read(leftPaddleEid)
    const paddleTop = leftTransform.y + PADDLE_HALF_HEIGHT
    const paddleBottom = leftTransform.y - PADDLE_HALF_HEIGHT
    const paddleFront = leftTransform.x + PADDLE_HALF_WIDTH

    if (nextX - BALL_RADIUS <= paddleFront && nextY <= paddleTop && nextY >= paddleBottom) {
      nextX = paddleFront + BALL_RADIUS
      const offset = clamp((nextY - leftTransform.y) / PADDLE_HALF_HEIGHT, -1, 1)
      const bounceAngle = offset * MAX_RETURN_ANGLE
      speed = Math.min(speed * BALL_SPEED_INCREMENT, MAX_BALL_SPEED)
      vx = Math.cos(bounceAngle) * speed
      vy = Math.sin(bounceAngle) * speed
    }
  }

  const rightPaddleEid = getPaddleEid(scene, 'RightPaddle')
  if (rightPaddleEid !== undefined && vx > 0) {
    const rightTransform = Transform.read(rightPaddleEid)
    const paddleTop = rightTransform.y + PADDLE_HALF_HEIGHT
    const paddleBottom = rightTransform.y - PADDLE_HALF_HEIGHT
    const paddleFront = rightTransform.x - PADDLE_HALF_WIDTH

    if (nextX + BALL_RADIUS >= paddleFront && nextY <= paddleTop && nextY >= paddleBottom) {
      nextX = paddleFront - BALL_RADIUS
      const offset = clamp((nextY - rightTransform.y) / PADDLE_HALF_HEIGHT, -1, 1)
      const bounceAngle = offset * MAX_RETURN_ANGLE
      speed = Math.min(speed * BALL_SPEED_INCREMENT, MAX_BALL_SPEED)
      vx = -Math.cos(bounceAngle) * speed
      vy = Math.sin(bounceAngle) * speed
    }
  }

  if (nextX - BALL_RADIUS < FIELD.minX) {
    updateScore(scene, 'right')
    return
  }

  if (nextX + BALL_RADIUS > FIELD.maxX) {
    updateScore(scene, 'left')
    return
  }

  Transform.assign(ballEid, { x: nextX, y: nextY })
  Ball.assign(ballEid, { velocityX: vx, velocityY: vy, speed })
}

const xml = await fetch('./game.xml').then((res) => res.text())

gameBuilder
  .addSystem(gameSystem)
  .runWithXML(xml)
