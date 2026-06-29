import Camera from './camera.ts'

describe('Camera', () => {
  it('starts with identity view', () => {
    const camera = new Camera()
    const view = camera.view()
    expect(view[0]).toBe(1)
    expect(view[4]).toBe(1)
    expect(view[6]).toBe(0)
    expect(view[7]).toBe(0)
  })

  it('reset restores identity', () => {
    const camera = new Camera()
    camera.pan(10, 20)
    camera.reset()
    const view = camera.view()
    expect(view[0]).toBeCloseTo(1)
    expect(view[4]).toBeCloseTo(1)
    expect(view[6]).toBeCloseTo(0)
    expect(view[7]).toBeCloseTo(0)
  })

  it('pans by translating view', () => {
    const camera = new Camera()
    camera.pan(0.5, -0.3)
    const view = camera.view()
    expect(view[6]).toBeCloseTo(0.5)
    expect(view[7]).toBeCloseTo(-0.3)
  })

  it('converts world to screen and back without projection', () => {
    const camera = new Camera()
    const width = 800
    const height = 600
    const world: [number, number] = [0.25, -0.5]
    const screen = camera.worldToScreen(world[0], world[1], width, height)
    const roundTrip = camera.screenToWorld(screen[0], screen[1], width, height)
    expect(roundTrip[0]).toBeCloseTo(world[0])
    expect(roundTrip[1]).toBeCloseTo(world[1])
  })

  it('round-trips screen/world after pan', () => {
    const camera = new Camera()
    camera.pan(0.2, -0.4)
    const width = 800
    const height = 600
    const world: [number, number] = [0.1, 0.3]
    const screen = camera.worldToScreen(world[0], world[1], width, height)
    const roundTrip = camera.screenToWorld(screen[0], screen[1], width, height)
    expect(roundTrip[0]).toBeCloseTo(world[0])
    expect(roundTrip[1]).toBeCloseTo(world[1])
  })

  it('clamps zoom scale between min and max', () => {
    const camera = new Camera()
    camera.zoomAt(0.001, 0, 0)
    expect(camera.distance()).toBeCloseTo(0.1)
    camera.zoomAt(1000, 0, 0)
    expect(camera.distance()).toBeCloseTo(10)
  })

  it('onWheel zooms around the given point', () => {
    const camera = new Camera()
    const width = 800
    const height = 600
    camera.onWheel(120, 400, 300, width, height)
    expect(camera.distance()).not.toBe(1)
    // The view should still be valid (invertible).
    const view = camera.view()
    expect(view[0]).toBeGreaterThan(0)
  })

  it('onMouseMove returns false when there is no movement', () => {
    const camera = new Camera()
    const width = 800
    const height = 600
    camera.onMouseDown(100, 100)
    const moved = camera.onMouseMove(100, 100, width, height)
    expect(moved).toBe(false)
  })

  it('onMouseMove returns true and pans when there is movement', () => {
    const camera = new Camera()
    const width = 800
    const height = 600
    camera.onMouseDown(100, 100)
    const moved = camera.onMouseMove(150, 120, width, height)
    expect(moved).toBe(true)
    const view = camera.view()
    expect(view[6]).not.toBe(0)
  })
})
