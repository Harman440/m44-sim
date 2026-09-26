import { Box } from "@mui/material";
import { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import { FACTION_COLORS } from "../looks/looks";
import { orderColor } from "./OrderComponent";
import { unitSprite } from "./UnitComponent";

interface OrderTokenProps {
  orderIndex: number;
  unitType: UnitType;
  faction: Faction;
  size?: number;
}

/** A unit's token, ringed in the colour of its order's arrow on the map */
function OrderToken({ orderIndex, unitType, faction, size = 52 }: OrderTokenProps) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        bgcolor: "#f1ead6",
        border: "4px solid",
        borderColor: orderColor(orderIndex),
        boxShadow: `inset 0 0 0 2px ${FACTION_COLORS[faction]}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box component="img" src={unitSprite(faction, unitType)} alt="" sx={{ width: size * 0.7, height: size * 0.7 }} />
    </Box>
  );
}

export default OrderToken;
