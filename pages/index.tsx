import {
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
} from "@mui/icons-material";
import {
  Box,
  Card,
  CardMedia,
  Container,
  Grid as Grid_,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  paperClasses,
  styled,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  experimental_sx,
  CardContent,
  SxProps,
  Theme,
  gridClasses,
} from "@mui/material";
import type { GetStaticProps } from "next";
import { useState } from "react";
import { match } from "ts-pattern";

import { FlexBox } from "@/components/FlexBox";
import type { GameSummary } from "@/src/typed-summary-data";
import { isGameException } from "@/src/typed-summary-data";
import { sxPropToArray } from "@/src/utils/sx-prop-to-array";

const getGameImage = (game: GameSummary): string =>
  match(game)
    .when(isGameException, (game) =>
      match(game)
        .with({ name: "Oh, Deer!" }, (game) => game.thumbnail_url)
        .with(
          { name: "The Incredible Machine Mega Pack" },
          (game) => game.thumbnail_url
        )
        .exhaustive()
    )
    .with({ ref_type: "humble" }, (game) => game.image_url)
    .with(
      { ref_type: "steam" },
      (game) =>
        `https://cdn.cloudflare.steamstatic.com/steam/${game.steam_type}s/${game.steam_id}/header.jpg`
    )
    .with({ ref_type: "developer" }, (game) => game.thumbnail_url)
    .exhaustive();

function formatExistenceDate(date: number): string {
  return new Date(date * 1000).toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
function formatExistenceDateShort(date: number): string {
  return new Date(date * 1000).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const AvailabilityText = styled(Typography)`
  color: ${(t) => t.theme.palette.text.secondary};
`;

function CurrentAvailability({
  current: [start, end],
  size = "large",
  sx = {},
}: {
  current: readonly [number, number];
  size?: "small" | "large";
  sx?: SxProps<Theme>;
}) {
  return match(size)
    .with("large", () => (
      <FlexBox sx={[{ mb: 2 }, ...sxPropToArray(sx)]}>
        <FlexBox sx={{ mr: 2, flexDirection: "column", alignItems: "end" }}>
          <AvailabilityText>Available since</AvailabilityText>
          <AvailabilityText>and until</AvailabilityText>
        </FlexBox>
        <FlexBox sx={{ flexDirection: "column" }}>
          <AvailabilityText>{formatExistenceDate(start)}</AvailabilityText>
          <AvailabilityText>{formatExistenceDate(end)}</AvailabilityText>
        </FlexBox>
      </FlexBox>
    ))
    .with("small", () => (
      <AvailabilityText sx={[{ mb: 2 }, ...sxPropToArray(sx)]} variant="body2">
        {formatExistenceDateShort(start)} - {formatExistenceDateShort(end)}
      </AvailabilityText>
    ))
    .exhaustive();
}

function GameSummaryListItem({ game }: { game: GameSummary }) {
  return (
    <ListItem alignItems="center">
      <ListItemAvatar sx={{ mr: 4 }}>
        <Box
          component="img"
          sx={{ width: "12rem", borderRadius: 2 }}
          src={getGameImage(game)}
          alt={`thumbnail for "${game.name}" game`}
        />
      </ListItemAvatar>
      <ListItemText
        disableTypography
        primary={<Typography variant="h5">{game.name}</Typography>}
        secondary={
          <CurrentAvailability current={game.availability} size="large" />
        }
      />
    </ListItem>
  );
}

const Grid = styled(Grid_)(
  experimental_sx({
    [`&.${gridClasses.item} > .${paperClasses.root}`]: {
      borderRadius: 2,
      mx: "auto",
    },
  })
);

function GameSummaryGridItem({ game }: { game: GameSummary }) {
  return (
    <Card sx={{ minWidth: 250, maxWidth: 400 }}>
      <CardMedia
        component="img"
        sx={{ height: "12rem", borderRadius: 2 }}
        src={getGameImage(game)}
        alt={`thumbnail for "${game.name}" game`}
      />
      <CardContent>
        <Typography
          variant="h5"
          gutterBottom
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {game.name}
        </Typography>
        <CurrentAvailability
          current={game.availability}
          size="small"
          sx={{ textAlign: "right" }}
        />
      </CardContent>
    </Card>
  );
}

function useGridListToggleButton(init: "grid" | "list" = "grid") {
  const [toggle, setToggle] = useState<"grid" | "list">(init);

  const button = (
    <ToggleButtonGroup
      exclusive
      value={toggle}
      onChange={(e, nextView) =>
        match(nextView)
          .with("grid" as const, "list" as const, setToggle)
          .otherwise((value) => {
            throw new Error("Unsupported ToggleButton value: " + value);
          })
      }
    >
      <ToggleButton value="grid">
        <ViewModuleIcon sx={{ mr: 0.5 }} />
        Grid
      </ToggleButton>
      <ToggleButton value="list">
        <ViewListIcon sx={{ mr: 0.5 }} />
        List
      </ToggleButton>
    </ToggleButtonGroup>
  );

  return [toggle, button] as const;
}

export default function Home({
  summary,
}: {
  summary: ReadonlyArray<GameSummary>;
}) {
  const [gridListState, gridListButton] = useGridListToggleButton();

  return (
    <Container maxWidth="xl">
      <Typography variant="h1" align="center">
        Humble Trove Games
      </Typography>
      <Typography paragraph variant="caption">
        This website keeps the historic information about the games previously
        available via Humble Trove. There is also attempt to catalog the periods
        when these games were available. However, at some point between 2nd
        February 2022 and 9th February 2022 HumbleBundle made Humble Trove
        endpoint inaccessible. So all of these games are considered to have been
        available up until the 2nd of February 2022. Additionally, there is a
        gap in data between somewhere in June 2021 and the middle of January
        2022, since the data was not collected during that time period.
      </Typography>
      <FlexBox sx={{ mb: 2, justifyContent: "end" }}>{gridListButton}</FlexBox>
      {match(gridListState)
        .with("list", () => (
          <List>
            {summary.map((game) => (
              <GameSummaryListItem key={game.name} game={game} />
            ))}
          </List>
        ))
        .with("grid", () => (
          <Grid container spacing={2}>
            {summary.map((game) => (
              <Grid item key={game.name} xs={12} sm={6} lg={4} xl={3}>
                <GameSummaryGridItem game={game} />
              </Grid>
            ))}
          </Grid>
        ))
        .exhaustive()}
    </Container>
  );
}

export const getStaticProps: GetStaticProps<{
  summary: ReadonlyArray<GameSummary>;
}> = () =>
  import("@/src/typed-summary-data").then((_) => ({
    props: { summary: _.GameSummaryData },
  }));
