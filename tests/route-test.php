<?php
declare(strict_types=1);
require __DIR__.'/../src/RoutePlanner.php';
// Synthetic fixtures test code only. They are never shipped as scientific map data.
function check(bool $ok,string $name):void {if(!$ok)throw new RuntimeException($name);echo "PASS $name\n";}
$start=['lat'=>0.002,'lon'=>0.0];$end=['lat'=>0.002,'lon'=>0.004];
$g=['width'=>5,'height'=>5,'north'=>0.004,'west'=>0.0,'latitudeStep'=>0.001,'longitudeStep'=>0.001,'cellSizeM'=>100.0,'validated'=>true,'sources'=>['https://pds.nasa.gov/'],'cells'=>array_fill(0,25,['elevationM'=>0.0,'chemicalSafe'=>true,'radiationSafe'=>true,'heatSafe'=>true])];
check(RoutePlanner::plan($start,$end,null)['status']==='unavailable','Missing data remains unknown');
$r=RoutePlanner::plan($start,$end,$g);check($r['status']==='ok'&&count($r['points'])===5,'Flat-grid shortest path');
$g['cells'][12]['chemicalSafe']=false;$r=RoutePlanner::plan($start,$end,$g);check($r['status']==='ok'&&count($r['points'])>5,'Detours around chemical hazard');
foreach([2,7,12,17,22] as $i)$g['cells'][$i]['chemicalSafe']=false;
$r=RoutePlanner::plan($start,$end,$g);check($r['message']==='No Safe Path Between: Chemical','Chemical barrier attribution');
foreach([3,8,13,18,23] as $i)$g['cells'][$i]['radiationSafe']=false;
$r=RoutePlanner::plan($start,$end,$g);check(in_array('Chemical',$r['causes'],true)&&in_array('Radiation',$r['causes'],true),'Combined independent causes');
$g['cells'][0]['heatSafe']=null;check(RoutePlanner::plan($start,$end,$g)['status']==='unavailable','Missing hazard mask is unknown');
$g['cells']=array_fill(0,25,['elevationM'=>0.0,'chemicalSafe'=>true,'radiationSafe'=>true,'heatSafe'=>true]);
foreach([2,7,12,17,22] as $i)$g['cells'][$i]['elevationM']=500.0;
$r=RoutePlanner::plan($start,$end,$g);check($r['status']==='blocked'&&in_array('Height',$r['causes'],true),'Steep 500m wall blocked');
$g['sources']=['https://example.org/not-nasa'];check(RoutePlanner::plan($start,$end,$g)['status']==='unavailable','Rejects non-NASA provenance');
require_once __DIR__.'/../src/GlobalRoute.php';
$pub=__DIR__.'/../public';
$pFeet=GlobalRoute::vehicleProfile('feet',10);
$pFeetHeavy=GlobalRoute::vehicleProfile('feet',90);
$pTruck=GlobalRoute::vehicleProfile('truck',0);
$pTruckHeavy=GlobalRoute::vehicleProfile('truck',2000);
check($pFeet['maxSlope']===0.8&&$pFeetHeavy['maxSlope']<0.8,'Feet slope stays 0.8 for light cargo and decreases for heavy cargo');
check($pTruck['maxSlope']===0.2&&$pTruckHeavy['maxSlope']<0.2,'Truck max slope is 0.2 (dy/dx) and scales with heavy payload');
$grFeet=GlobalRoute::plan(['lat'=>18.44463,'lon'=>77.45088],['lat'=>18.0,'lon'=>77.0],'terrain',$pub,['vehicle'=>'feet','cargoKg'=>10]);
$grTruck=GlobalRoute::plan(['lat'=>18.44463,'lon'=>77.45088],['lat'=>18.0,'lon'=>77.0],'terrain',$pub,['vehicle'=>'truck','cargoKg'=>0]);
check($grFeet['status']==='candidate'&&$grTruck['status']==='candidate','GlobalRoute finds paths for feet and truck');
check($grTruck['maxSampledSlope']<=0.2&&$grTruck['distanceM']>$grFeet['distanceM'],'Truck route detours around slopes > 0.2');
check(count($grTruck['bezierPoints'])>count($grTruck['points'])&&$grTruck['etaSeconds']>0,'Bezier curve points and ETA generated');
