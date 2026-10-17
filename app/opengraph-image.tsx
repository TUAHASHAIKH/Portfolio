import { ImageResponse } from 'next/og'
export const alt = 'Tuaha Shaikh — Software Engineer'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export default function Image() {
 return new ImageResponse(<div style={{width:'100%',height:'100%',background:'#a0a5b1',display:'flex',flexDirection:'column',justifyContent:'center',padding:90,color:'#fff'}}><div style={{fontSize:96,fontWeight:900,letterSpacing:-6}}>TUAHA SHAIKH</div><div style={{fontSize:26,color:'#343d4e',marginTop:20}}>Software Engineer / Full Stack / AI</div><div style={{fontSize:18,marginTop:100}}>A world built from curiosity.</div></div>,size)
}
