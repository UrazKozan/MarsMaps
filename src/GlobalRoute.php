<?php
declare(strict_types=1);
require_once __DIR__.'/MarsRaster.php';
/** Terrain candidate routing. Full safety mode never treats missing hazards as safe. */
final class GlobalRoute {
    private const R=3389500.0;
    public static function vehicleProfile(string $vehicle,float $cargoKg):array {
        $cargo=max(0.0,$cargoKg);
        switch($vehicle){
            case 'truck':
                $loadFactor=max(0.0,($cargo-500.0)/2500.0);
                $maxSlope=max(0.08,0.20/(1.0+0.35*$loadFactor));
                $reliefLimit=25.0;
                $baseSpeedKmh=max(3.0,10.0/(1.0+0.25*($cargo/1000.0)));
                $slopeWeight=16.0*(1.0+0.3*($cargo/1000.0));
                $riseWeight=4.5*(1.0+0.25*($cargo/1000.0));
                break;
            case 'rover':
                $loadFactor=max(0.0,($cargo-20.0)/100.0);
                $maxSlope=max(0.18,0.50/(1.0+0.4*$loadFactor));
                $reliefLimit=35.0;
                $baseSpeedKmh=max(0.05,0.152/(1.0+0.3*($cargo/50.0)));
                $slopeWeight=12.0*(1.0+0.3*($cargo/50.0));
                $riseWeight=3.0*(1.0+0.25*($cargo/50.0));
                break;
            case 'crew-rover':
                $loadFactor=max(0.0,($cargo-150.0)/490.0);
                $maxSlope=max(0.16,0.466/(1.0+0.35*$loadFactor));
                $reliefLimit=40.0;
                $baseSpeedKmh=max(4.0,14.0/(1.0+0.25*($cargo/490.0)));
                $slopeWeight=11.0*(1.0+0.25*($cargo/490.0));
                $riseWeight=2.8*(1.0+0.2*($cargo/490.0));
                break;
            case 'feet':
            default:
                $vehicle='feet';
                if($cargo<=25.0){
                    $maxSlope=0.8;
                    $reliefLimit=50.0;
                    $baseSpeedKmh=max(1.2,2.2-0.012*$cargo);
                    $slopeWeight=8.0;
                    $riseWeight=2.0;
                }else{
                    $over=$cargo-25.0;
                    $maxSlope=max(0.25,0.8/(1.0+$over/45.0));
                    $reliefLimit=max(25.0,50.0-0.25*$over);
                    $baseSpeedKmh=max(0.6,1.9/(1.0+$over/50.0));
                    $slopeWeight=8.0*(1.0+$over/40.0);
                    $riseWeight=2.0*(1.0+$over/35.0);
                }
                break;
        }
        return [
            'vehicle'=>$vehicle,
            'cargoKg'=>$cargo,
            'maxSlope'=>round($maxSlope,4),
            'reliefLimitM'=>round($reliefLimit,1),
            'baseSpeedKmh'=>round($baseSpeedKmh,3),
            'slopeWeight'=>$slopeWeight,
            'riseWeight'=>$riseWeight,
        ];
    }
    public static function plan(array $start,array $end,string $mode,string $public,array $options=[]):array {
        $terrain=new MarsRaster($public);
        if(!$terrain->available())return ['status'=>'unavailable','message'=>'NASA elevation tiles are still being prepared.'];
        if($mode==='all')return ['status'=>'unavailable','message'=>'Complete safety routing needs calibrated chemical, radiation and temperature coverage.','missing'=>['Chemical','Radiation','Heat']];
        $profile=self::vehicleProfile((string)($options['vehicle']??'feet'),(float)($options['cargoKg']??0.0));
        $slopeLimit=$profile['maxSlope'];
        $reliefLimit=$profile['reliefLimitM'];
        $slopeWeight=$profile['slopeWeight'];
        $riseWeight=$profile['riseWeight'];
        $baseSpeedMs=max(0.01,$profile['baseSpeedKmh']/3.6);
        $a=self::vector($start);$b=self::vector($end);$dot=max(-1,min(1,array_sum(array_map(fn($x,$y)=>$x*$y,$a,$b))));$angle=acos($dot);$distance=$angle*self::R;
        if($distance<1){
            $bezier=self::bezierCurve([$start,$end],$terrain,$slopeLimit,$reliefLimit);
            return ['status'=>'candidate','points'=>[$start,$end],'bezierPoints'=>$bezier,'distanceM'=>0,'ascentM'=>0,'maxSampledSlope'=>0,'etaSeconds'=>0,'etaHours'=>0,'etaSols'=>0,'averageSpeedKmh'=>$profile['baseSpeedKmh'],'vehicle'=>$profile['vehicle'],'cargoKg'=>$profile['cargoKg'],'maxSlopeLimit'=>$slopeLimit,'reliefLimitM'=>$reliefLimit,'resolutionM'=>$terrain->resolution((float)$start['lat']),'missing'=>['Chemical','Radiation','Heat'],'message'=>'Same start and destination; no travel required.'];
        }
        // A local azimuthal equidistant projection avoids longitude seam and polar singularities.
        $mid=[$a[0]+$b[0],$a[1]+$b[1],$a[2]+$b[2]];$length=sqrt(array_sum(array_map(fn($x)=>$x*$x,$mid)));
        if($length<1e-6){$center=['lat'=>0.0,'lon'=>(float)$start['lon']+90];}else{$center=['lat'=>rad2deg(asin($mid[2]/$length)),'lon'=>rad2deg(atan2($mid[1],$mid[0]))];}
        [$sx,$sy]=self::project($start,$center);[$ex,$ey]=self::project($end,$center);
        $native=max($terrain->resolution((float)$start['lat']),$terrain->resolution((float)$end['lat']));
        $step=max($native,$distance/160);$padding=max($step*8,$distance*.22);
        $minX=min($sx,$ex)-$padding;$maxX=max($sx,$ex)+$padding;$minY=min($sy,$ey)-$padding;$maxY=max($sy,$ey)+$padding;
        $step=max($step,($maxX-$minX)/220,($maxY-$minY)/220);$w=(int)ceil(($maxX-$minX)/$step)+1;$h=(int)ceil(($maxY-$minY)/$step)+1;
        $ix=static fn(float $x,float $y):int=>(int)round(($y-$minY)/$step)*$w+(int)round(($x-$minX)/$step);
        $first=$ix($sx,$sy);$last=$ix($ex,$ey);$cells=[];
        $chem=self::chemistry($public);
        $get=function(int $i)use(&$cells,$w,$minX,$minY,$step,$center,$terrain,$chem,$slopeLimit,$reliefLimit):array{
            if(isset($cells[$i]))return $cells[$i];
            $p=self::inverse($minX+($i%$w)*$step,$minY+intdiv($i,$w)*$step,$center);$g=$terrain->gradient($p['lat'],$p['lon']);
            $g['point']=$p;$g['blocked']=$g['height']===null||($g['slope']>$slopeLimit&&$g['relief']>$reliefLimit);$g['chlorine']=self::chemSample($chem,$p);
            return $cells[$i]=$g;
        };
        $queue=new SplPriorityQueue();$queue->setExtractFlags(SplPriorityQueue::EXTR_DATA);$queue->insert($first,0);$cost=[$first=>0.0];$parent=[];$closed=[];$found=false;
        if($get($first)['blocked']||$get($last)['blocked'])return ['status'=>'blocked','message'=>'No Safe Path Between: Height','causes'=>['Height'],'vehicle'=>$profile['vehicle'],'cargoKg'=>$profile['cargoKg'],'maxSlopeLimit'=>$slopeLimit,'reliefLimitM'=>$reliefLimit,'scope'=>'Terrain-only assessment at source resolution'];
        while(!$queue->isEmpty()){
            $i=$queue->extract();if(isset($closed[$i]))continue;if($i===$last){$found=true;break;}$closed[$i]=true;$c=$get($i);$x=$i%$w;$y=intdiv($i,$w);
            foreach([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as [$dx,$dy]){
                $nx=$x+$dx;$ny=$y+$dy;if($nx<0||$ny<0||$nx>=$w||$ny>=$h)continue;$j=$ny*$w+$nx;if(isset($closed[$j]))continue;$n=$get($j);if($n['blocked'])continue;
                if($dx&&$dy&&($get($y*$w+$nx)['blocked']||$get($ny*$w+$x)['blocked']))continue;
                $len=self::distance($c['point'],$n['point']);$rise=abs($n['height']-$c['height']);
                if($len<.01||($rise/$len>$slopeLimit&&$rise>$reliefLimit))continue;
                // Probe skipped source pixels on coarse overview edges; bounded to 32 probes.
                $probes=min(32,max(1,(int)ceil($len/$native)));$blocked=false;
                for($q=1;$q<$probes;$q++){ $f=$q/$probes;$p=self::inverse($minX+($x+$dx*$f)*$step,$minY+($y+$dy*$f)*$step,$center);$g=$terrain->gradient($p['lat'],$p['lon']);if($g['height']===null||($g['slope']>$slopeLimit&&$g['relief']>$reliefLimit)){$blocked=true;break;} }
                if($blocked)continue;
                // Chlorine is a soft compositional preference only, never a toxicity threshold.
                $chemCost=$n['chlorine']===null?0:max(0,$n['chlorine'])*.5;
                $new=$cost[$i]+$len*(1+$slopeWeight*$n['slope']+$chemCost)+$riseWeight*$rise;
                if($new<($cost[$j]??INF)){$cost[$j]=$new;$parent[$j]=$i;$heuristic=self::distance($n['point'],$end);$queue->insert($j,-($new+$heuristic));}
            }
            if(count($closed)>48000)break;
        }
        if(!$found)return ['status'=>'search_exhausted','message'=>'No terrain route found in the searched corridor. Expand the search or choose closer endpoints.','vehicle'=>$profile['vehicle'],'cargoKg'=>$profile['cargoKg'],'maxSlopeLimit'=>$slopeLimit,'reliefLimitM'=>$reliefLimit,'scope'=>'Bounded search; this does not prove that no route exists anywhere.'];
        $ids=[$last];$i=$last;while(isset($parent[$i])){$i=$parent[$i];$ids[]=$i;}$ids=array_reverse($ids);$points=array_map(fn($id)=>$get($id)['point'],$ids);
        // Preserve exact requested endpoints instead of returning only cell centers.
        array_unshift($points,$start);$points[]=$end;
        $bezierPoints=self::bezierCurve($points,$terrain,$slopeLimit,$reliefLimit);
        $total=0.0;$maxSlope=0.0;$ascent=0.0;$etaSeconds=0.0;$previous=null;$chemKnown=0;
        foreach($points as $p){
            $g=$terrain->gradient($p['lat'],$p['lon']);
            $slope=(float)($g['slope']??0.0);
            $maxSlope=max($maxSlope,$slope);
            if(self::chemSample($chem,$p)!==null)$chemKnown++;
            if($previous){
                $segLen=self::distance($previous['point'],$p);
                $dh=($g['height']??0.0)-$previous['height'];
                $segRise=max(0.0,$dh);
                $total+=$segLen;
                $ascent+=$segRise;
                $segSlope=$segLen>1.0?max($slope,abs($dh)/$segLen):$slope;
                $gradeFactor=1.0+1.8*($segSlope/max(0.05,$slopeLimit))+($dh>0?1.2*($dh/max(1.0,$segLen))/max(0.05,$slopeLimit):0.35*abs($dh)/max(1.0,$segLen)/max(0.05,$slopeLimit));
                $segSpeed=max(0.08*$baseSpeedMs,$baseSpeedMs/$gradeFactor);
                $etaSeconds+=$segLen/$segSpeed;
            }
            $previous=['point'=>$p,'height'=>$g['height']??0.0];
        }
        $avgSpeedKmh=$etaSeconds>0?($total/1000.0)/($etaSeconds/3600.0):$profile['baseSpeedKmh'];
        return [
            'status'=>'candidate',
            'points'=>$points,
            'bezierPoints'=>$bezierPoints,
            'distanceM'=>$total,
            'ascentM'=>$ascent,
            'maxSampledSlope'=>$maxSlope,
            'etaSeconds'=>round($etaSeconds),
            'etaHours'=>round($etaSeconds/3600.0,2),
            'etaSols'=>round($etaSeconds/88775.244,3),
            'averageSpeedKmh'=>round($avgSpeedKmh,3),
            'vehicle'=>$profile['vehicle'],
            'cargoKg'=>$profile['cargoKg'],
            'maxSlopeLimit'=>$slopeLimit,
            'reliefLimitM'=>$reliefLimit,
            'resolutionM'=>$native,
            'searchStepM'=>$step,
            'missing'=>['Chemical safety','Radiation','Heat'],
            'chlorineCoverage'=>$chemKnown/count($points),
            'message'=>'Terrain candidate generated. Human-safety hazards remain unassessed.',
            'sources'=>['https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=MGS-M-MOLA-5-MEGDR-L3-V1.0']
        ];
    }
    /** Generates a smooth composite cubic Bézier path through route control points, falling back per segment if any smoothed midpoint violates terrain slope limits. */
    public static function bezierCurve(array $points,MarsRaster $terrain,float $slopeLimit,float $reliefLimit):array {
        $raw=[];
        foreach($points as $p){
            if(!$raw||self::distance($raw[count($raw)-1],$p)>1.0)$raw[]=['lat'=>(float)$p['lat'],'lon'=>(float)$p['lon']];
        }
        $n=count($raw);
        if($n<2)return $points;
        if($n===2){
            return [
                $raw[0],
                self::slerp($raw[0],$raw[1],0.25),
                self::slerp($raw[0],$raw[1],0.50),
                self::slerp($raw[0],$raw[1],0.75),
                $raw[1],
            ];
        }
        // Corner-cutting B-spline / cubic Bézier control points on 3D unit vectors
        $vecs=array_map(fn($p)=>self::vector($p),$raw);
        $out=[$raw[0]];
        $tension=0.35;
        for($i=0;$i<$n-1;$i++){
            $p0=$vecs[max(0,$i-1)];
            $p1=$vecs[$i];
            $p2=$vecs[$i+1];
            $p3=$vecs[min($n-1,$i+2)];
            $b1=[
                $p1[0]+($p2[0]-$p0[0])*($tension/3.0),
                $p1[1]+($p2[1]-$p0[1])*($tension/3.0),
                $p1[2]+($p2[2]-$p0[2])*($tension/3.0),
            ];
            $b2=[
                $p2[0]-($p3[0]-$p1[0])*($tension/3.0),
                $p2[1]-($p3[1]-$p1[1])*($tension/3.0),
                $p2[2]-($p3[2]-$p1[2])*($tension/3.0),
            ];
            $segSamples=[];
            $valid=true;
            $sub=4;
            for($s=1;$s<=$sub;$s++){
                $t=$s/$sub;
                $u=1.0-$t;
                $vx=$u*$u*$u*$p1[0]+3*$u*$u*$t*$b1[0]+3*$u*$t*$t*$b2[0]+$t*$t*$t*$p2[0];
                $vy=$u*$u*$u*$p1[1]+3*$u*$u*$t*$b1[1]+3*$u*$t*$t*$b2[1]+$t*$t*$t*$p2[1];
                $vz=$u*$u*$u*$p1[2]+3*$u*$u*$t*$b1[2]+3*$u*$t*$t*$b2[2]+$t*$t*$t*$p2[2];
                $pt=self::fromVec([$vx,$vy,$vz]);
                if($s<$sub){
                    $g=$terrain->gradient($pt['lat'],$pt['lon']);
                    if($g['height']===null||($g['slope']>$slopeLimit&&$g['relief']>$reliefLimit)){
                        $valid=false;
                        break;
                    }
                }
                $segSamples[]=$pt;
            }
            if($valid){
                foreach($segSamples as $pt)$out[]=$pt;
            }else{
                for($s=1;$s<=$sub;$s++)$out[]=self::slerp($raw[$i],$raw[$i+1],$s/$sub);
            }
        }
        return $out;
    }
    private static function slerp(array $a,array $b,float $f):array {
        $u=self::vector($a);$v=self::vector($b);
        $dot=max(-1.0,min(1.0,$u[0]*$v[0]+$u[1]*$v[1]+$u[2]*$v[2]));
        $angle=acos($dot);
        if($angle<1e-7)return ['lat'=>(float)$a['lat']*(1-$f)+(float)$b['lat']*$f,'lon'=>(float)$a['lon']*(1-$f)+(float)$b['lon']*$f];
        $sa=sin($angle);
        $l=sin((1.0-$f)*$angle)/$sa;$r=sin($f*$angle)/$sa;
        return self::fromVec([$u[0]*$l+$v[0]*$r,$u[1]*$l+$v[1]*$r,$u[2]*$l+$v[2]*$r]);
    }
    private static function fromVec(array $v):array {
        $len=sqrt($v[0]*$v[0]+$v[1]*$v[1]+$v[2]*$v[2]);
        if($len<1e-12)return ['lat'=>0.0,'lon'=>0.0];
        return ['lat'=>rad2deg(asin(max(-1.0,min(1.0,$v[2]/$len)))),'lon'=>fmod(rad2deg(atan2($v[1],$v[0]))+540.0,360.0)-180.0];
    }
    private static function vector(array $p):array{$lat=deg2rad((float)$p['lat']);$lon=deg2rad((float)$p['lon']);return [cos($lat)*cos($lon),cos($lat)*sin($lon),sin($lat)];}
    public static function distance(array $a,array $b):float{$u=self::vector($a);$v=self::vector($b);return self::R*acos(max(-1,min(1,array_sum(array_map(fn($x,$y)=>$x*$y,$u,$v)))));}
    private static function project(array $p,array $c):array{$lat=deg2rad((float)$p['lat']);$lon=deg2rad((float)$p['lon']);$p0=deg2rad($c['lat']);$l0=deg2rad($c['lon']);$cos=max(-1,min(1,sin($p0)*sin($lat)+cos($p0)*cos($lat)*cos($lon-$l0)));$a=acos($cos);$k=$a<1e-9?1:$a/max(1e-9,sin($a));return [self::R*$k*cos($lat)*sin($lon-$l0),self::R*$k*(cos($p0)*sin($lat)-sin($p0)*cos($lat)*cos($lon-$l0))];}
    private static function inverse(float $x,float $y,array $c):array{$rho=hypot($x,$y);if($rho<1e-9)return $c;$a=$rho/self::R;$p0=deg2rad($c['lat']);$l0=deg2rad($c['lon']);$lat=asin(max(-1,min(1,cos($a)*sin($p0)+$y*sin($a)*cos($p0)/$rho)));$lon=$l0+atan2($x*sin($a),$rho*cos($p0)*cos($a)-$y*sin($p0)*sin($a));return ['lat'=>rad2deg($lat),'lon'=>fmod(rad2deg($lon)+540,360)-180];}
    private static function chemistry(string $public):?array{$m=$public.'/assets/hazards/manifest.json';if(!is_file($m))return null;$data=json_decode(file_get_contents($m),true);foreach($data['layers']??[] as $layer){if(in_array(($layer['id']??''),['chemistry','chlorine'],true) && isset($layer['values'])){$path=$public.'/'.$layer['values'];if(is_file($path))return json_decode(file_get_contents($path),true);}}return null;}
    private static function chemSample(?array $g,array $p):?float{if(!$g||!isset($g['values'],$g['width'],$g['height']))return null;$x=((int)floor(($p['lon']+180)/360*$g['width'])%$g['width']+$g['width'])%$g['width'];$y=max(0,min($g['height']-1,(int)floor((90-$p['lat'])/180*$g['height'])));$v=$g['values'][$y*$g['width']+$x]??null;return is_numeric($v)?(float)$v:null;}
}
