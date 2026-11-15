<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
function respond(array $value,int $code=200): never {http_response_code($code);echo json_encode($value,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
$action=$_GET['action']??'';
if($action==='landmarks' && $_SERVER['REQUEST_METHOD']==='GET') {
    $catalog=json_decode(file_get_contents(__DIR__.'/assets/catalog.json'),true,512,JSON_THROW_ON_ERROR);
    respond(['landmarks'=>$catalog['landmarks']]);
}
if($action!=='route')respond(['error'=>'Unknown endpoint'],404);
if($_SERVER['REQUEST_METHOD']!=='POST'){header('Allow: POST');respond(['error'=>'Use POST'],405);}
if((int)($_SERVER['CONTENT_LENGTH']??0)>4096)respond(['error'=>'Request too large'],413);
$raw=file_get_contents('php://input',false,null,0,4097);if(strlen($raw)>4096)respond(['error'=>'Request too large'],413);
try{$request=json_decode($raw,true,16,JSON_THROW_ON_ERROR);}catch(JsonException $e){respond(['error'=>'Invalid JSON'],400);}
if(!is_array($request))respond(['error'=>'Expected a JSON object'],400);
foreach(['start','end'] as $key){$p=$request[$key]??null;if(!is_array($p)||!isset($p['lat'],$p['lon'])||!is_numeric($p['lat'])||!is_numeric($p['lon'])||!is_finite((float)$p['lat'])||!is_finite((float)$p['lon'])||abs((float)$p['lat'])>90||abs((float)$p['lon'])>180)respond(['error'=>'Invalid latitude or longitude'],400);}
require_once __DIR__.'/../src/GlobalRoute.php';
$mode=$request['mode']??'terrain';
if(!in_array($mode,['terrain','all'],true))respond(['error'=>'Invalid route mode'],400);
$vehicle=$request['vehicle']??'feet';
if(!is_string($vehicle)||!in_array($vehicle,['feet','rover','truck','crew-rover'],true))respond(['error'=>'Invalid vehicle type'],400);
$cargoKg=isset($request['cargoKg'])?($request['cargoKg']):0.0;
if(!is_numeric($cargoKg)||!is_finite((float)$cargoKg)||(float)$cargoKg<0||(float)$cargoKg>100000)respond(['error'=>'Invalid cargo mass'],400);
set_time_limit(180);
respond(GlobalRoute::plan($request['start'],$request['end'],$mode,__DIR__,['vehicle'=>$vehicle,'cargoKg'=>(float)$cargoKg]));
