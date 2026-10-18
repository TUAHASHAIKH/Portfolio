import * as THREE from 'three'
import type { RingAssets } from './ring-assets'

const common = `
uniform float time;uniform float opacity;uniform vec3 eye;uniform vec2 resolution;
float ss(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
float falloff(float x,float a,float b,float width,float p){float w=width*sign(b-a);float edge=mix(a-w,b,p);return ss(edge+w,edge,x);}
vec2 turn(vec2 p,float a){return mat2(cos(a),sin(a),-sin(a),cos(a))*p;}
vec3 rotateAxis(vec3 p,vec3 axis,float a){return p*cos(a)+cross(axis,p)*sin(a)+axis*dot(axis,p)*(1.-cos(a));}
float waves(vec3 p){return sin(p.x*2.1+sin(p.y*1.9+p.z))*sin(p.y*1.3-p.z*.7);}
vec3 sky(vec2 uv){float g=(uv.x+uv.y)*.5;g*=waves(vec3(uv,time*.614))*.5+.5;g*=waves(vec3(uv*2.,time*.17))*.5+.5;return mix(vec3(.144,.159,.205),vec3(.753,.791,.88),g)*1.1;}
`
const surface = `varying vec2 vUv;varying vec3 vPos;varying float vDepth;`
const vertex = `${common}${surface}
void main(){vUv=uv;vPos=position;vec4 mv=modelViewMatrix*vec4(position,1.);vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`

export function makeRingMaterials(assets: RingAssets, wind: THREE.Texture) {
  const shared = { time:{value:0}, opacity:{value:0}, eye:{value:new THREE.Vector3()}, resolution:{value:new THREE.Vector2(1,1)} }
  const make = (vertexShader: string, fragmentShader: string, uniforms: Record<string,THREE.IUniform> = {}, additive = false) => new THREE.ShaderMaterial({
    uniforms:{...shared,...uniforms}, vertexShader, fragmentShader,
    transparent:true,depthWrite:!additive,side:THREE.DoubleSide,
    blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,
  })
  const rings = [0,1,2].map(index => make(`${common}${surface}
    attribute vec3 centr;attribute vec3 rand;uniform float ringY;uniform float motion;
    varying float vFalloff;varying float vFade;
    void main(){vUv=uv;vec3 pos=position;vec4 original=modelViewMatrix*vec4(pos,1.);vPos=original.xyz;vDepth=-original.z;
      float dist=distance(eye,vec3(0.,ringY,0.));float first=1.-step(-2.,ringY);
      float cam=clamp(-eye.z*.8,0.,1.);
      vFalloff=falloff(dist,14.,2.,13.,.75);float glow=1.-ss(.2,.4,1.-vFalloff);
      vec3 center=centr*.3;vec3 axis=normalize(rand*2.-1.);
      float angle=.5*ss(1.5,12.,vDepth)+first*cam*.5;
      pos=rotateAxis(pos-center,axis,angle)+center;
      pos+=centr*glow*mix(.075,.15,rand.z);
      pos+=rand.y*centr*glow*sin(rand.x*5.+time*.5+dot(centr,vec3(15.)))*.05*motion;
      pos+=centr*cam*.15*first;
      pos.xz=turn(pos.xz,falloff(dist,8.,2.,5.,.5)*3.14159*.3);
      pos.xy=turn(pos.xy,falloff(dist,10.,2.,8.,.5)*3.14159*.3+ringY*.25+1.5);
      vFade=falloff(dist,2.,16.,9.,.5);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);
    }`,`${common}${surface}
    uniform sampler2D map;uniform sampler2D glow;varying float vFalloff;varying float vFade;
    void main(){vec3 color=texture2D(map,vUv).rgb;
      color=mix(sky(gl_FragCoord.xy/resolution),color,vFade*.95);
      float light=ss(.2,.4,1.-vFalloff);float n=(waves(vPos+time*.5+color.r*5.)*.5+.5)*.5+.5;
      color+=texture2D(glow,vUv).r*vec3(.5,.7,1.)*n*light*.8*pow(1.-clamp(-eye.z,0.,1.),4.);
      gl_FragColor=vec4(color,opacity);
    }`,{map:{value:index===1?assets.innerMap:assets.outerMap},glow:{value:index===1?assets.innerGlow:assets.outerGlow},ringY:{value:-1.65-index*2.5},motion:{value:1}}))
  const field = make(vertex,`${common}${surface}
    uniform sampler2D triangles;uniform sampler2D clouds;uniform float ringY;
    void main(){float y=length(vUv-.5)*2.;float n=texture2D(clouds,vUv*.25+ringY).r*texture2D(clouds,vUv*.8+ringY).r;
      n=sin(n*13.+time-y*10.)*.5+.5;float aa=max(fwidth(n),.001);float mask=smoothstep(.2-aa,.2+aa,n)*(1.-n*.75);
      float tri=texture2D(triangles,vUv*2.+n*.04).r*4.;float alpha=min(1.,tri*mask+pow(mask,5.)*.5+ss(.5,1.,y)*.5);
      float near=ss(3.5,2.3,vDepth);alpha*=ss(.9,.85,y)*ss(.45-near*.25,.75-near*.3,length(vUv-.5));
      alpha*=1.-clamp(-eye.z*8.,0.,1.);
      gl_FragColor=vec4(.7,.8,1.,alpha*opacity);
    }`,{triangles:{value:assets.triangles},clouds:{value:assets.clouds},ringY:{value:0}},true)
  const fields = [field,field.clone(),field.clone()]
  const plasma = make(vertex,`${common}${surface}
    uniform sampler2D wind;
    void main(){vec2 uv=vUv*vec2(.25,.5);uv.x+=uv.y;float t=-time*.075;
      float n=texture2D(wind,uv*3.+vec2(-t,t*.7)).r*texture2D(wind,uv*4.+vec2(-t,t*.7)).r*texture2D(wind,uv*6.+vec2(-t,t*.7)).r;
      float value=n*ss(.3,.4,vUv.x)*ss(.6,.5,vUv.x);float glow=ss(.3,.45,vUv.x)*ss(.8,.4,vUv.x);
      value+=glow*.3+glow*glow*n*.2;value*=ss(4.,2.,vDepth)*ss(.4,1.,vDepth);
      float alpha=min(1.,pow(value*1.7,4.))*pow(1.-clamp(-eye.z,0.,1.),4.);
      gl_FragColor=vec4(.65,.8,1.,alpha*opacity);
    }`,{wind:{value:wind}},true)
  const tunnel = make(vertex,`${common}${surface}
    uniform sampler2D wind;
    void main(){vec2 uv=vUv*vec2(1.,.25);uv.x+=uv.y;float t=time*.05;
      float n=texture2D(wind,uv*3.+vec2(-t,t*.7)).r*texture2D(wind,uv*4.+vec2(-t,t*.7)).r*texture2D(wind,uv*6.+vec2(-t,t*.7)).r;
      n*=ss(0.,.2,vUv.y)*ss(1.,.9,vUv.y);float alpha=min(.3,pow(n*3.,3.));
      gl_FragColor=vec4(.65,.8,1.,alpha*opacity);
    }`,{wind:{value:wind}},true)
  const floor = make(`${common}${surface}
    attribute float animationmask;attribute float iteration;varying vec3 vOriginal;uniform float motion;
    void main(){vUv=uv;vOriginal=position;vec3 axis=rotateAxis(normalize(vec3(0.,.5,1.)),vec3(0.,1.,0.),time*.625+iteration*1.2);
      vec3 p=rotateAxis(position,axis,.03*animationmask*motion);
      p.y-=(sin(iteration-time*.5)*.01+.04)*animationmask*motion;vPos=p;vDepth=0.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
    }`,`${common}${surface}
    uniform sampler2D map;uniform float reveal;uniform float glowFactor;uniform float chamber;varying vec3 vOriginal;
    void main(){float len=length(vPos.xz);vec3 color=texture2D(map,vUv).rgb;
      color*=mix(.65,1.,vPos.x*.5+.5);color+=(vPos.x+1.)*.02;
      float shadow=pow(min(1.,length(vPos*1.5+vec3(1.15,0.,-.55))),2.);
      shadow+=sin(time*3.3+vPos.z*5.)*.1+.1+sin(time*3.1+vPos.x*4.)*.1+.1;
      color*=mix(vec3(.05,.07,.1),vec3(1.),mix(.5,1.,shadow));
      vec3 blue=vec3(.5,.7,1.)*(1.-ss(1.4,1.6,len));
      color+=blue*glowFactor*(ss(.087,-.1,vOriginal.y)+ss(.087,.05,vOriginal.y)*(sin(vPos.z*5.+len*10.-time*.75)*.5+.5));
      color*=1.+chamber*.3;
      float alpha=falloff(len*3.,0.,6.,3.,reveal)*ss(1.99,1.3,len);
      gl_FragColor=vec4(color,alpha*opacity);
    }`,{map:{value:assets.floorMap},reveal:{value:0},glowFactor:{value:1},chamber:{value:0},motion:{value:1}})
  floor.depthWrite=true;floor.side=THREE.FrontSide
  const core = make(`${common}
    uniform float forming;uniform float pixelRatio;varying float light;varying float seed;
    void main(){seed=fract(sin(dot(position,vec3(127.1,311.7,74.7)))*43758.5453);
      vec3 pos=position+normal*sin(time+seed*30.)*.0015;
      pos+=normal*forming*.018*sin(seed*94.+time*.7);
      light=pow(clamp(dot(normalize(normal),normalize(vec3(-.75,1.,-.1)))*.5+.5,0.,1.),1.5);
      vec4 mv=modelViewMatrix*vec4(pos,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(5./length(mv.xyz)*(resolution.y/1300.),.75,4.5*pixelRatio);
    }`,`${common}
    uniform float glow;uniform float reveal;varying float light;varying float seed;
    void main(){float circle=step(length(gl_PointCoord-.5),.5);if(circle<.001)discard;
      vec3 color=mix(vec3(.016,.024,.055),vec3(.51,.56,.65),light);color=mix(color,vec3(1.4,1.8,2.5),glow);
      gl_FragColor=vec4(color,circle*reveal*opacity);
    }`,{glow:{value:1},reveal:{value:0},forming:{value:1},pixelRatio:{value:1}})
  const background = make(`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,1.,1.);}`,`${common}
    varying vec2 vUv;void main(){gl_FragColor=vec4(sky(vUv),opacity);}`)
  background.depthWrite=false;background.depthTest=false
  const halo=make(vertex,`${common}${surface}uniform float reveal;
    void main(){float r=length(vUv-.5);float alpha=ss(.5,.3,r)*ss(.3,.4,r)*ss(.03,.1,abs(vUv.x-.5));
      alpha*=mix(1.,.8,sin(time*2.+r+vUv.x*2.+vUv.y)*.5+.5);
      gl_FragColor=vec4(vec3(2.),alpha*reveal*opacity*.45);}`,{reveal:{value:0}},true)
  const chamberField=make(vertex,`${common}${surface}uniform sampler2D triangles;uniform sampler2D clouds;uniform float reveal;
    void main(){vec2 uv=vUv*vec2(10.,7.5);float n=texture2D(clouds,uv*.18+vec2(time*.015,-time*.03)).r;
      float grid=texture2D(triangles,uv*.7+vec2(0.,time*.008)).r;
      float alpha=grid*ss(.18,.55,n)*ss(0.,.15,vUv.y)*ss(1.,.7,vUv.y)*.065;
      gl_FragColor=vec4(.65,.8,1.,alpha*reveal*opacity);}`,{triangles:{value:assets.triangles},clouds:{value:assets.clouds},reveal:{value:0}},true)
  const materials = [...rings,...fields,plasma,tunnel,floor,core,background,halo,chamberField]
  return { shared,rings,fields,plasma,tunnel,floor,core,background,halo,chamberField,materials,dispose:()=>materials.forEach(material=>material.dispose()) }
}
