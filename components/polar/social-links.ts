export const SOCIAL_LINKS = [
  { name:'GitHub', href:'https://github.com/TUAHASHAIKH' },
  { name:'LinkedIn', href:'https://www.linkedin.com/in/muhammad-tuaha-shaikh' },
  { name:'WhatsApp', href:'https://wa.me/923116102857' },
  { name:'Gmail', href:'mailto:tuaha486@gmail.com' },
] as const

export const socialIndex = (index: number) => ((index%SOCIAL_LINKS.length)+SOCIAL_LINKS.length)%SOCIAL_LINKS.length

// Code-native silhouettes become extruded particle surfaces in the worker.
// They use no web fonts, downloaded bitmaps, or platform-dependent glyphs.
export function socialMasks() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256
  const ctx=canvas.getContext('2d')!
  ctx.scale(256/24,256/24)
  const mask=()=>{
    const rgba=ctx.getImageData(0,0,256,256).data,data=new Uint8Array(256*256)
    for(let i=0;i<data.length;i++)data[i]=rgba[i*4+3]
    return data
  }
  ctx.fillStyle='white'
  // LinkedIn's i and n, including the circular dot, drawn as closed shapes.
  ctx.beginPath();ctx.arc(5,5,1.9,0,Math.PI*2);ctx.fill()
  ctx.fillRect(3.3,8.3,3.4,12.2)
  ctx.fill(new Path2D('M9 8.3H12.3V10C13.2 8.5 14.5 8 16.2 8C19.8 8 21 10.2 21 13.6V20.5H17.5V14.1C17.5 12.1 17 11 15.2 11C13.3 11 12.5 12.4 12.5 14.2V20.5H9Z'))
  const linkedin=mask()
  ctx.clearRect(0,0,24,24)
  ctx.lineWidth=1.55;ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='white'
  ctx.beginPath();ctx.arc(12,11.5,9.3,2.55,2.19+Math.PI*2);ctx.lineTo(2.8,21);ctx.closePath();ctx.stroke()
  // Center the handset in the circular bowl (rather than including its tail
  // when positioning it). Keep a clear margin between phone and outer ring.
  ctx.save();ctx.translate(12.1,11.6);ctx.scale(.86,.86);ctx.translate(-11.8,-11.8)
  ctx.fill(new Path2D('M8.1 6.4C7.6 6.2 7 6.4 6.7 7C5.4 9.5 7.6 13.2 10.5 15.3C12.4 16.8 15.6 18 17 15.9L17.7 14.5C17.9 14.1 17.7 13.8 17.3 13.6L14.8 12.4C14.4 12.2 14.1 12.3 13.8 12.7L13 13.8C11.2 13 9.8 11.7 9.1 10.1L10 9.1C10.3 8.8 10.3 8.5 10.1 8.1L9.2 6.6Z'))
  ctx.restore()
  const whatsapp=mask()
  ctx.clearRect(0,0,24,24)
  // Gmail's folded M shares the same extruded particle treatment.
  ctx.lineWidth=3.2
  ctx.stroke(new Path2D('M3 19V5L12 12L21 5V19'))
  return [linkedin,whatsapp,mask()]
}
