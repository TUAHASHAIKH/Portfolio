// Synthesized once in a worker; audio only starts after a user gesture.
self.onmessage=()=>{
 const rate=22050,count=rate*8,buffer=new ArrayBuffer(44+count*2),view=new DataView(buffer);
 const str=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
 str(0,'RIFF');view.setUint32(4,36+count*2,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,count*2,true);
 let low=0;
 for(let i=0;i<count;i++){low=(low+.025*(Math.random()*2-1))/1.025;const fade=Math.min(1,i/(rate*.5),(count-i)/(rate*.5));view.setInt16(44+i*2,low*11000*fade*(.65+.35*Math.sin(i/rate*.785)),true);}
 self.postMessage(buffer,[buffer]);
};
