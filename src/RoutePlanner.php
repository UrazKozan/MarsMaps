<?php
declare(strict_types=1);

/** A* over a regional, equally spaced NASA-derived terrain grid.
 * Coverage and hazard masks must be prepared/validated offline. No invented values.
 */
final class RoutePlanner
{
    private const SLOPE_LIMIT = 0.8;
    private const RELIEF_LIMIT_M = 50.0;

    public static function plan(array $start, array $end, ?array $grid): array
    {
        if (!$grid || !self::validGrid($grid)) {
            return ['status'=>'unavailable', 'missing'=>['Height','Chemical','Radiation','Heat'],
                'message'=>'Route assessment unavailable: validated NASA terrain and hazard coverage is not loaded.'];
        }
        $w=$grid['width']; $h=$grid['height'];
        $index = static function(array $p) use($grid,$w,$h): ?int {
            $x=(int)round(($p['lon']-$grid['west'])/$grid['longitudeStep']);
            $y=(int)round(($grid['north']-$p['lat'])/$grid['latitudeStep']);
            if ($x<0 || $x>=$w || $y<0 || $y>=$h) return null;
            return $y*$w+$x;
        };
        $s=$index($start); $goal=$index($end);
        if ($s===null || $goal===null) return ['status'=>'unavailable','message'=>'Route endpoints are outside validated coverage.'];
        // Coverage gaps are unknown, never a scientific claim that there is no safe path.
        foreach ($grid['cells'] as $cell) {
            if (!isset($cell['elevationM']) || !is_numeric($cell['elevationM']) || !is_finite((float)$cell['elevationM'])) return ['status'=>'unavailable','message'=>'Terrain coverage contains gaps.'];
            foreach (['chemicalSafe','radiationSafe','heatSafe'] as $key) {
                if (!isset($cell[$key]) || !is_bool($cell[$key])) return ['status'=>'unavailable','message'=>'Hazard coverage contains gaps.'];
            }
        }
        $reasons=[];
        $result=self::search($s,$goal,$grid,[]);
        if ($result===null) {
            // Report only constraints whose removal changes connectivity. If several
            // independently block the route, isolate each constraint in a separate pass.
            $all=['Height','Chemical','Radiation','Heat'];
            foreach ($all as $reason) {
                if (self::search($s,$goal,$grid,[$reason])!==null ||
                    self::search($s,$goal,$grid,array_values(array_diff($all,[$reason])))===null) $reasons[]=$reason;
            }
            if (!$reasons) return ['status'=>'blocked','message'=>'No Safe Path Between: Combined constraints','causes'=>[]];
            return ['status'=>'blocked','message'=>'No Safe Path Between: '.implode(', ',$reasons),'causes'=>$reasons];
        }
        $points=[];
        foreach($result as $i) $points[]=['lat'=>$grid['north']-intdiv($i,$w)*$grid['latitudeStep'], 'lon'=>$grid['west']+($i%$w)*$grid['longitudeStep']];
        return ['status'=>'ok','points'=>$points,'scope'=>'Validated grid only; not a certified human safety assessment.','sources'=>$grid['sources']];
    }

    private static function validGrid(array $g): bool
    {
        foreach(['width','height','north','west','latitudeStep','longitudeStep','cellSizeM','cells','sources','validated'] as $key) if(!isset($g[$key])) return false;
        if($g['validated']!==true || !is_int($g['width']) || !is_int($g['height']) || $g['width']<2 || $g['height']<2 || $g['width']*$g['height']>40000) return false;
        foreach(['north','west','latitudeStep','longitudeStep','cellSizeM'] as $key) if(!is_numeric($g[$key]) || !is_finite((float)$g[$key])) return false;
        if($g['latitudeStep']<=0 || $g['longitudeStep']<=0 || $g['cellSizeM']<=0 || !is_array($g['cells']) || count($g['cells'])!==$g['width']*$g['height']) return false;
        if(!is_array($g['sources']) || !$g['sources']) return false;
        foreach($g['sources'] as $url){$host=parse_url((string)$url,PHP_URL_HOST);if(!is_string($host) || !preg_match('/(^|\.)nasa\.gov$/i',$host))return false;}
        return true;
    }

    private static function search(int $start,int $goal,array $g,array $ignore): ?array
    {
        $w=$g['width'];$h=$g['height'];$cells=$g['cells'];$size=(float)$g['cellSizeM'];
        $pass = static function(int $i) use($cells,$ignore):bool {
            foreach(['Chemical'=>'chemicalSafe','Radiation'=>'radiationSafe','Heat'=>'heatSafe'] as $reason=>$key)
                if(!in_array($reason,$ignore,true) && !$cells[$i][$key]) return false;
            return true;
        };
        if(!$pass($start)||!$pass($goal))return null;
        $gradient=[];$relief=[];
        foreach($cells as $i=>$cell){
            $x=$i%$w;$y=intdiv($i,$w);$left=$y*$w+max(0,$x-1);$right=$y*$w+min($w-1,$x+1);$top=max(0,$y-1)*$w+$x;$bottom=min($h-1,$y+1)*$w+$x;
            $dx=($cells[$right]['elevationM']-$cells[$left]['elevationM'])/(($right-$left)*$size);
            $dy=($cells[$bottom]['elevationM']-$cells[$top]['elevationM'])/((($bottom-$top)/$w)*$size);
            $gradient[$i]=hypot($dx,$dy);
            $z=[$cell['elevationM'],$cells[$left]['elevationM'],$cells[$right]['elevationM'],$cells[$top]['elevationM'],$cells[$bottom]['elevationM']];
            $relief[$i]=max($z)-min($z);
        }
        $terrainPass=static fn(int $i):bool=>in_array('Height',$ignore,true) || !($gradient[$i]>self::SLOPE_LIMIT && $relief[$i]>self::RELIEF_LIMIT_M);
        if(!$terrainPass($start)||!$terrainPass($goal))return null;
        $queue=new SplPriorityQueue();$queue->setExtractFlags(SplPriorityQueue::EXTR_DATA);$queue->insert($start,0);$cost=[$start=>0.0];$prev=[];$closed=[];
        while(!$queue->isEmpty()){
            $i=$queue->extract();if(isset($closed[$i]))continue;
            if($i===$goal){$path=[$i];while(isset($prev[$i])){$i=$prev[$i];$path[]=$i;}return array_reverse($path);}
            $closed[$i]=true;$x=$i%$w;$y=intdiv($i,$w);
            // Four-connected edges cannot cut through the corner of a blocked cell.
            foreach([[1,0],[-1,0],[0,1],[0,-1]] as [$dx,$dy]){
                $nx=$x+$dx;$ny=$y+$dy;if($nx<0||$nx>=$w||$ny<0||$ny>=$h)continue;
                $j=$ny*$w+$nx;if(isset($closed[$j])||!$pass($j)||!$terrainPass($j))continue;
                $rise=abs($cells[$j]['elevationM']-$cells[$i]['elevationM']);
                if(!in_array('Height',$ignore,true)&&$rise/$size>self::SLOPE_LIMIT&&$rise>self::RELIEF_LIMIT_M)continue;
                $new=$cost[$i]+$size*(1+2*$gradient[$j])+2*$rise;
                if($new<($cost[$j]??INF)){$cost[$j]=$new;$prev[$j]=$i;$heuristic=(abs($nx-$goal%$w)+abs($ny-intdiv($goal,$w)))*$size;$queue->insert($j,-($new+$heuristic));}
            }
        }
        return null;
    }
}
