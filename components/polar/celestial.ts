// Shared sky and refraction backdrop. Slowly advected noise folds the aurora
// into ribbons; fine rays follow those folds instead of forming vertical bars.
export const celestial = `
uniform float skyTime;uniform float starTravel;uniform float skyMotion;uniform float skySeed;
float starHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float skyNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(starHash(i),starHash(i+vec2(1.,0.)),f.x),mix(starHash(i+vec2(0.,1.)),starHash(i+1.),f.x),f.y);
}
float skyCloud(vec2 p){return skyNoise(p)*.57+skyNoise(p*2.03+7.1)*.28+skyNoise(p*4.07+13.7)*.15;}
vec3 nightSky(vec2 uv,float aspect,float sceneTime,float aurora){
  float t=skyTime;
  vec2 p=vec2(uv.x*aspect,uv.y);
  vec3 col=mix(vec3(.0025,.004,.009),vec3(.014,.022,.034),pow(1.-uv.y,2.));
  float cloud=skyCloud(p*vec2(2.1,3.)+vec2(t*.008,-t*.004));
  col+=vec3(.009,.012,.019)*smoothstep(.35,.85,cloud);
  for(int i=0;i<3;i++){
    float layer=float(i);
    // Different angular velocities give distant stars a subtle sense of depth.
    vec2 drift=vec2(t*(.0012+layer*.00035),t*.0003);
    vec2 g=(p+drift-vec2(0.,starTravel*(.65+layer*.22)))*(95.+layer*47.);
    vec2 cell=floor(g);float seed=starHash(cell+layer*23.);
    // Empty star cells contribute exactly zero. Avoid their remaining hashes,
    // distance and twinkle calculations (over 99% of cells in each layer).
    if(seed<.991)continue;
    vec2 center=vec2(starHash(cell+5.7),starHash(cell+41.3))*.7+.15;
    float d=length(fract(g)-center);
    float star=(1.-smoothstep(.018,.138,d))*step(.991,seed);
    col+=mix(vec3(.45,.55,.68),vec3(.87,.86,.79),seed)*star*(.2+.5*seed)*(.8+.2*sin(t*.65+seed*90.));
  }
  // Two curved emission sheets: a bright lower hem, translucent green
  // body, and a long teal tail. Warping the entire sheet keeps rays attached
  // to the folds as they advect, rather than scrolling a striped texture.
  for(int i=0;i<2;i++){
    float k=float(i),flow=t*.23;
    float x=(uv.x-.5)*min(aspect,1.8)+.5;
    float drift=flow*.32+k*1.9;
    float warp=skyCloud(vec2(x*2.8-drift*.18,k*3.+flow*.12));
    float folded=x+sin(x*4.7-flow*.35+k)*.13+warp*.1;
    float arc=sin(folded*4.2+drift)*.078;
    arc+=sin(folded*9.5-flow*.26+k*2.)*.022;
    float base=.85+k*.095+arc+(uv.x-.5)*(.10-k*.13);
    float h=uv.y-base;
    float swept=folded+sin(h*8.+flow*.28)*h*.35;
    float vitality=.55+.45*skyNoise(vec2(swept*4.-flow*.3,k+flow*.07));
    float envelope=(.25+.75*pow(max(0.,sin(uv.x*3.14159)),.6))*(.6+.4*sin(swept*2.+k+1.));
    // Below a curtain, its body and upper veil are zero and the Gaussian
    // fringes underflow. Keep the same diffuse halo without shading its rays.
    if(h<-.3){
      col+=vec3(.025,.12,.12)*exp(-abs(h)*24.)*vitality*envelope*aurora*(.95-k*.22);
      continue;
    }
    float broad=skyCloud(vec2(swept*8.-flow*.4,h*3.+k*7.));
    float rays=skyNoise(vec2(swept*170.-flow*1.4,flow*.16+k*9.));
    float strands=.65+.35*rays;
    float body=exp(-max(h,0.)*(14.+k*3.))*smoothstep(-.035,.012,h);
    float hemDistance=h/(.008+broad*.007);
    float hem=exp(-hemDistance*hemDistance);
    float halo=exp(-abs(h)*24.);
    // Color follows the height and changing folds of each curtain: emerald
    // bodies, blue-violet fringes, and a diffuse rose canopy above them.
    float colorFlow=.5+.5*sin(swept*3.6-flow*.16+k*2.1);
    float violetFold=smoothstep(.5,.88,colorFlow)*(.55+.45*broad);
    vec3 green=vec3(.035,.64,.18);
    vec3 teal=vec3(.025,.20,.19);
    vec3 plume=mix(green,teal,smoothstep(.015,.12,max(h,0.)));
    plume=mix(plume,vec3(.20,.085,.35),violetFold*smoothstep(.005,.08,h)*.65);
    vec3 edge=mix(vec3(.19,.80,.22),vec3(.20,.55,.55),broad);
    edge=mix(edge,vec3(.23,.20,.65),violetFold*.52);
    vec3 emission=plume*body*strands*(.55+broad*.65);
    emission+=edge*hem*(.24+broad*.38);
    emission+=vec3(.025,.12,.12)*halo;
    float upperDistance=(h-.105)*9.;
    float upperVeil=exp(-upperDistance*upperDistance)*smoothstep(-.015,.05,h);
    float rosePatch=.35+.65*smoothstep(.12,.85,1.-colorFlow);
    vec3 rose=mix(vec3(.24,.045,.075),vec3(.32,.09,.22),broad);
    emission+=rose*upperVeil*rosePatch*(.6+strands*.25);
    // A narrow blue fringe varies with the folds instead of forming a stripe.
    float fringeDistance=(h+.012)/.022;
    emission+=vec3(.045,.07,.28)*exp(-fringeDistance*fringeDistance)*violetFold;
    col+=emission*vitality*envelope*aurora*(.95-k*.22);
  }
  // One brief meteor in a randomly selected portion of a sparse time window.
  // The page seed changes its schedule and path on each visit. No timers,
  // particles, allocations, or additional draw calls are needed.
  float windowId=floor(t/10.);
  float seed=starHash(vec2(windowId,skySeed));
  float onset=1.5+starHash(vec2(windowId+7.,skySeed))*6.;
  float age=mod(t,10.)-onset;
  float duration=.65+seed*.35;
  if(skyMotion>.5 && seed>.22 && age>0. && age<duration){
    float phase=age/duration;
    vec2 start=vec2((.12+seed*.7)*aspect,.97);
    vec2 direction=normalize(vec2(seed>.5?.8:-.8,-.48));
    vec2 head=start+direction*(.22+seed*.12)*phase;
    vec2 delta=p-head;
    float behind=-dot(delta,direction);
    float across=dot(delta,vec2(-direction.y,direction.x));
    float tail=exp(-across*across/.0000012)*(1.-smoothstep(0.,.10,behind))*step(0.,behind);
    float core=exp(-dot(delta,delta)/.000003);
    float envelope=sin(phase*3.14159);
    col+=(vec3(.22,.42,.66)*tail+vec3(.9,.95,1.)*core)*envelope;
  }
  return col;
}
`
