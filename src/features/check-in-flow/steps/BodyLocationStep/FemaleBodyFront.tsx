import { useLingui } from '@lingui/react/macro'
import type { BodyZone } from '@/entities/check-in/types'
import { BODY_FILL, SELECTED_FILL } from './bodyZoneMap'
import { BODY_OUTLINE_PATH } from './femaleBodyOutline'
import { useRegionLabel } from './useRegionLabel'

type Region = { zone: BodyZone; d: string }

// Every shape is its own zone (labelled by useRegionLabel) so tapping one
// part doesn't light up its neighbors. "Head & neck" is a single shape in
// this artwork, so `neck` isn't reachable from the front view; "pelvic"
// isn't reachable either — both are back-view-only trade-offs of this
// asset vs. the old muscle-map library.
const REGIONS: Region[] = [
  { zone: 'head', d: 'M380.5 99.5L408.5 101.0L425.0 109.0L440.5 126.5L444.5 137.5L446.0 151.0L445.0 179.5L441.0 200.5L433.5 218.5L426.5 228.5L409.5 244.0L393.5 252.0L383.0 250.5L369.5 242.5L353.0 225.5L342.5 205.5L337.0 179.5L336.5 142.0L343.0 124.0L352.5 112.0L366.5 103.0L380.5 100.0Z' },
  { zone: 'trapLeft', d: 'M368.0 253.5L387.5 261.5L387.0 295.5L319.5 295.5L361.5 279.0L366.0 272.5L368.0 254.0Z' },
  { zone: 'trapRight', d: 'M411.5 253.0L415.5 272.5L418.5 277.5L463.0 294.5L394.0 295.5L393.5 262.0L411.5 253.5Z' },
  { zone: 'shoulderLeft', d: 'M290.5 304.5L294.5 305.0L297.0 309.5L300.5 334.0L298.5 356.0L287.5 332.5L284.0 312.0L290.5 305.0Z' },
  { zone: 'shoulderRight', d: 'M486.5 303.5L492.5 305.5L496.0 310.5L493.5 333.0L485.5 351.5L482.0 354.5L481.0 332.0L486.5 304.0Z' },
  { zone: 'chestLeft', d: 'M306.0 301.0L386.5 302.0L388.0 315.5L388.0 390.5L311.5 390.0L312.0 365.0L307.5 359.5L307.0 321.5L303.5 306.0L303.5 301.5L306.0 301.5Z' },
  { zone: 'chestRight', d: 'M454.0 300.5L478.5 302.0L474.5 322.5L473.0 357.0L470.5 369.0L471.0 390.5L393.5 390.5L393.5 301.5L454.0 301.0Z' },
  { zone: 'upperArmLeft', d: 'M277.0 326.0L288.5 353.5L299.5 370.0L302.5 382.5L300.5 412.0L287.0 478.5L284.5 479.5L272.5 472.5L257.5 471.0L268.0 401.0L273.5 341.0L277.0 326.5Z' },
  { zone: 'upperArmRight', d: 'M503.5 325.5L507.5 338.0L516.0 419.5L525.0 471.0L507.5 473.0L494.0 479.5L479.5 400.0L481.0 372.5L497.0 346.5L503.5 326.0Z' },
  { zone: 'ribsLeft', d: 'M312.0 397.5L388.0 397.5L387.0 495.5L327.5 492.5L324.0 459.5L312.0 398.0Z' },
  { zone: 'ribsRight', d: 'M393.5 397.5L469.5 397.5L456.5 465.0L454.5 492.5L408.0 495.5L394.5 495.5L394.0 493.0L393.5 398.0Z' },
  { zone: 'elbowLeft', d: 'M262.5 480.0L274.5 482.5L280.5 487.5L280.5 490.0L276.0 492.0L265.5 490.0L258.5 484.5L259.0 482.0L262.5 480.5Z' },
  { zone: 'elbowRight', d: 'M517.0 480.0L524.0 482.5L520.5 488.0L510.0 492.0L500.5 490.5L504.5 484.0L517.0 480.5Z' },
  { zone: 'absLeft', d: 'M325.5 499.0L387.5 502.0L388.0 534.5L388.0 563.0L346.0 558.0L305.5 547.5L306.0 541.0L325.5 499.5Z' },
  { zone: 'absRight', d: 'M447.0 499.0L455.0 499.0L458.5 503.5L471.0 530.5L476.0 547.0L467.0 551.5L441.5 557.5L393.5 563.0L394.5 502.5L447.0 499.5Z' },
  { zone: 'forearmLeft', d: 'M250.5 490.5L263.0 499.0L282.5 501.0L281.5 513.0L274.5 536.0L246.5 608.5L242.0 610.5L229.0 606.5L227.5 599.5L238.5 527.0L242.0 511.0L250.5 491.0Z' },
  { zone: 'forearmRight', d: 'M529.5 491.5L534.0 496.5L542.0 522.5L554.0 606.5L535.5 610.5L507.5 537.5L499.5 508.0L499.5 500.5L518.5 499.0L529.5 492.0Z' },
  { zone: 'hipLeft', d: 'M303.0 554.0L344.0 565.5L387.5 570.5L389.0 588.0L389.0 645.5L388.0 649.5L385.5 649.0L374.5 641.5L340.0 610.0L293.5 584.0L296.5 569.5L303.0 554.5Z' },
  { zone: 'hipRight', d: 'M479.0 555.5L488.0 577.0L489.0 586.0L487.5 588.0L471.0 595.0L441.0 613.0L409.5 641.0L397.0 649.0L394.0 649.0L393.0 646.5L392.5 625.5L393.0 570.5L437.5 566.0L479.0 556.0Z' },
  { zone: 'wristLeft', d: 'M228.0 615.5L235.5 616.0L241.0 622.0L239.0 633.5L233.0 638.0L228.0 638.0L223.0 634.0L220.5 627.5L221.0 621.5L228.0 616.0Z' },
  { zone: 'wristRight', d: 'M549.0 616.0L556.5 617.5L561.0 624.5L561.0 630.5L557.5 635.5L552.5 637.5L547.0 636.5L542.0 631.0L541.5 623.5L545.0 618.0L549.0 616.5Z' },
  { zone: 'handLeft', d: 'M218.0 644.5L240.0 647.0L239.5 669.5L233.0 704.5L231.5 705.5L230.0 702.0L230.5 680.0L228.0 669.5L224.0 672.5L218.0 690.0L217.5 709.0L223.0 725.0L215.0 716.5L205.5 686.0L206.5 677.0L218.0 645.0Z' },
  { zone: 'handRight', d: 'M561.0 644.5L563.5 644.5L565.5 648.0L575.5 680.0L574.0 696.0L564.5 720.5L560.0 723.0L564.0 709.0L564.5 690.5L559.5 681.0L558.0 671.0L554.5 670.0L552.5 673.5L551.0 706.5L548.0 704.0L541.5 671.0L542.0 646.0L561.0 645.0Z' },
  { zone: 'quadLeft', d: 'M289.5 593.5L324.5 610.0L345.0 624.5L376.0 654.5L376.5 668.0L370.5 769.0L368.0 862.5L364.5 862.5L356.0 856.0L344.0 854.5L330.0 858.5L321.5 866.0L298.5 782.0L284.5 703.5L282.0 645.5L289.5 594.0Z' },
  { zone: 'quadRight', d: 'M490.0 595.5L492.0 595.5L495.0 608.0L499.0 639.5L497.5 699.0L484.0 780.0L461.5 865.5L450.5 857.5L440.5 854.5L426.5 856.5L416.0 864.5L414.0 864.0L410.0 755.5L405.5 696.0L405.5 656.0L449.0 618.0L490.0 596.0Z' },
  { zone: 'kneeLeft', d: 'M341.0 863.5L350.0 864.0L357.0 867.5L363.5 876.0L365.5 885.5L362.0 896.0L351.5 904.5L341.5 905.5L333.0 901.5L325.0 890.0L324.5 880.0L333.0 867.0L341.0 864.0Z' },
  { zone: 'kneeRight', d: 'M435.5 862.5L443.0 864.0L449.0 868.0L454.0 874.5L456.5 882.5L455.5 892.0L446.5 903.0L434.0 905.5L426.0 902.0L419.0 893.0L418.0 878.0L425.0 868.0L435.5 863.0Z' },
  { zone: 'shinLeft', d: 'M320.5 903.0L332.5 912.0L341.5 914.5L351.5 914.5L365.0 908.0L369.0 961.5L368.0 1006.0L361.5 1064.5L361.0 1122.5L346.0 1121.5L337.5 1125.0L320.5 1034.0L313.5 982.5L314.0 952.0L320.5 903.5Z' },
  { zone: 'shinRight', d: 'M460.0 904.0L462.5 908.0L468.5 948.5L469.0 980.5L463.5 1021.5L444.5 1125.5L434.5 1121.5L421.0 1122.0L419.5 1051.0L412.5 990.0L416.5 908.0L430.0 914.0L441.5 915.0L451.5 911.5L460.0 904.5Z' },
  { zone: 'ankleLeft', d: 'M348.5 1129.5L358.5 1131.5L364.0 1142.0L362.5 1149.0L357.0 1153.5L345.5 1153.0L341.5 1148.0L340.5 1139.5L343.5 1133.0L348.5 1130.0Z' },
  { zone: 'ankleRight', d: 'M429.5 1129.5L437.0 1132.5L442.5 1140.0L442.0 1146.5L436.5 1153.0L430.0 1155.0L423.5 1152.5L419.0 1146.0L419.0 1138.5L422.5 1133.0L429.5 1130.0Z' },
  { zone: 'footLeft', d: 'M362.5 1161.0L364.5 1165.0L365.5 1195.0L369.0 1214.0L367.5 1227.0L363.0 1231.5L355.0 1234.5L334.0 1232.5L323.0 1228.0L323.0 1223.0L336.0 1188.0L340.0 1162.5L357.5 1163.5L362.5 1161.5Z' },
  { zone: 'footRight', d: 'M417.0 1161.0L424.0 1163.0L442.5 1162.5L444.0 1182.0L458.5 1223.5L456.5 1229.5L437.5 1234.0L424.5 1234.0L416.0 1229.5L413.0 1222.0L413.0 1213.0L417.5 1187.5L417.0 1161.5Z' },
]

/** the zones this view can mark (used by tests: front and back never share one) */
export const FRONT_ZONES: BodyZone[] = REGIONS.map((region) => region.zone)

export const FemaleBodyFront = ({
  value,
  onToggle,
}: {
  value: BodyZone[]
  onToggle: (zone: BodyZone) => void
}) => {
  const { t } = useLingui()
  const regionLabel = useRegionLabel()
  return (
    <svg viewBox="193.5 88 394 1165" role="group" aria-label={t`Body, front view`}>
      {REGIONS.map((region) => (
        <path
          key={region.zone}
          d={region.d}
          fill={value.includes(region.zone) ? SELECTED_FILL : BODY_FILL}
          role="button"
          tabIndex={0}
          aria-label={regionLabel(region.zone)}
          aria-pressed={value.includes(region.zone)}
          onClick={() => onToggle(region.zone)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            onToggle(region.zone)
          }}
        />
      ))}
      <path d={BODY_OUTLINE_PATH} fill="var(--body-outline)" fillRule="evenodd" pointerEvents="none" />
    </svg>
  )
}
