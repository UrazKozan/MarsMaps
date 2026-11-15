<?php
declare(strict_types=1);
/** Reads native signed-metre NASA MOLA samples without expanding a global raster in RAM. */
final class MarsRaster {
    private array $manifest;
    private array $rows=[];
    private array $handles=[];
    private string $public;
    public function __construct(string $public) {
        $this->public=$public;
        $path=$public.'/assets/hires/manifest.json';
        $this->manifest=is_file($path)?json_decode(file_get_contents($path),true,512,JSON_THROW_ON_ERROR):[];
    }
    public function available():bool{return isset($this->manifest['elevation']);}
    public function metadata():array{return $this->manifest;}
    private function sample(array $meta,int $x,int $y):?float {
        $w=$meta['width'];$h=$meta['height'];$x=(($x%$w)+$w)%$w;$y=max(0,min($h-1,$y));
        $path=$meta['url']??'';$stride=$w;
        if(isset($meta['tileSize'])){
            $size=$meta['tileSize'];$tx=intdiv($x,$size);$ty=intdiv($y,$size);
            $path=str_replace(['{x}','{y}'],[(string)$tx,(string)$ty],$meta['urlTemplate']);
            $x%=$size;$y%=$size;$stride=$size;
        }
        $full=$this->public.'/'.$path;if(!is_file($full))return null;
        $key=$path.':'.$y;
        if(!isset($this->rows[$key])){
            if(!isset($this->handles[$path])){
                if(count($this->handles)>=32){$old=array_key_first($this->handles);fclose($this->handles[$old]);unset($this->handles[$old]);}
                $this->handles[$path]=fopen($full,'rb');
            }
            fseek($this->handles[$path],$y*$stride*2);
            $row=fread($this->handles[$path],$stride*2);
            if(strlen($row)!==$stride*2)return null;
            if(count($this->rows)>=256)unset($this->rows[array_key_first($this->rows)]);
            $this->rows[$key]=$row;
        }
        $value=unpack('v',substr($this->rows[$key],$x*2,2))[1];
        return (float)($value>=32768?$value-65536:$value);
    }
    public function height(float $lat,float $lon):?float {
        foreach(['detail','nativeElevation','elevation'] as $level){
            if(!isset($this->manifest[$level]))continue;
            $m=$this->manifest[$level];
            $x=(($lon+180)/360*$m['width'])-.5;$y=(90-$lat)/180*$m['height']-.5;
            $ix=(int)floor($x);$iy=(int)floor($y);$fx=$x-$ix;$fy=$y-$iy;
            $a=$this->sample($m,$ix,$iy);$b=$this->sample($m,$ix+1,$iy);$c=$this->sample($m,$ix,$iy+1);$d=$this->sample($m,$ix+1,$iy+1);
            if($a!==null&&$b!==null&&$c!==null&&$d!==null)return $a*(1-$fx)*(1-$fy)+$b*$fx*(1-$fy)+$c*(1-$fx)*$fy+$d*$fx*$fy;
        }
        return null;
    }
    public function resolution(float $lat):float {
        $m=$this->manifest['detail']??$this->manifest['nativeElevation']??$this->manifest['elevation'];
        // The 128 ppd cylindrical product excludes the outer 2 degrees at each pole.
        if(abs($lat)>88 && isset($this->manifest['elevation']))$m=$this->manifest['elevation'];
        return 2*M_PI*3389500/$m['width'];
    }
    public function gradient(float $lat,float $lon):array {
        $d=$this->resolution($lat);$deg=$d/3389500*180/M_PI;$dx=$deg/max(.02,cos(deg2rad($lat)));
        $z=$this->height($lat,$lon);$l=$this->height($lat,$lon-$dx);$r=$this->height($lat,$lon+$dx);
        $n=$this->height(min(90,$lat+$deg),$lon);$s=$this->height(max(-90,$lat-$deg),$lon);
        if(in_array(null,[$z,$l,$r,$n,$s],true))return ['height'=>null,'slope'=>null,'relief'=>null];
        return ['height'=>$z,'slope'=>hypot(($r-$l)/(2*$d),($n-$s)/(2*$d)),'relief'=>max($z,$l,$r,$n,$s)-min($z,$l,$r,$n,$s)];
    }
}
