export const WIND_COUNT = 1200

// The original wind integrates per-frame acceleration and 0.9 friction at
// 60 Hz. A fixed step preserves that trajectory on high-refresh displays.
export function stepWind(positions: Float32Array, velocities: Float32Array, seeds: Float32Array, time: number) {
  for (let i=0;i<seeds.length;i++) {
    const j=i*3, seed=seeds[i]
    velocities[j]=(velocities[j]+(Math.sin(time*.2+seed*15.6547)+Math.sign(seed-.5)*2)*.00075+.0025)*.9
    velocities[j+1]=(velocities[j+1]-.004*(.5+.3*((seed*31.342)%1)))*.9
    velocities[j+2]=(velocities[j+2]+.0025)*.9
    for(let axis=0;axis<3;axis++){
      const bound=axis===1?10:25, value=positions[j+axis]+velocities[j+axis]
      positions[j+axis]=((value+bound)%(bound*2)+bound*2)%(bound*2)-bound
    }
  }
}
