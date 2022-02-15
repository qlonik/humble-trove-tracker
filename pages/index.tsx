import {
  Box,
  Container,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  styled,
  Typography,
} from "@mui/material";
import type { GetStaticProps } from "next";
import { match } from "ts-pattern";

import { FlexBox } from "@/components/FlexBox";
import type { GameSummary } from "@/src/typed-summary-data";
import { isGameException } from "@/src/typed-summary-data";

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

const AvailabilityText = styled(Typography)`
  color: ${(t) => t.theme.palette.text.secondary};
`;

function CurrentAvailability({
  current: [start, end],
}: {
  current: readonly [number, number];
}) {
  return (
    <FlexBox sx={{ mb: 2 }}>
      <FlexBox sx={{ mr: 2, flexDirection: "column", alignItems: "end" }}>
        <AvailabilityText>Available since</AvailabilityText>
        <AvailabilityText>and until</AvailabilityText>
      </FlexBox>
      <FlexBox sx={{ flexDirection: "column" }}>
        <AvailabilityText>{formatExistenceDate(start)}</AvailabilityText>
        <AvailabilityText>{formatExistenceDate(end)}</AvailabilityText>
      </FlexBox>
    </FlexBox>
  );
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
        secondary={<CurrentAvailability current={game.availability} />}
      />
    </ListItem>
  );
}

export default function Home({
  summary,
}: {
  summary: ReadonlyArray<GameSummary>;
}) {
  return (
    <Container>
      <Typography variant="h1" align="center">
        Humble Trove Games
      </Typography>
      <Typography variant="caption">
        This website keeps the historic information about the games previously
        available via Humble Trove. There is also attempt to catalog the periods
        when these games were available. However, at some point between 2nd
        February 2022 and 9th February 2022 HumbleBundle made Humble Trove
        endpoint inaccessible. So all of these games are considered to have been
        available up until the 2nd of February 2022. Additionally, there is a
        gap in data between somewhere in June 2021 and the middle of January
        2022, since the data was not collected during that time period.
      </Typography>
      <List>
        {summary.map((game) => (
          <GameSummaryListItem key={game.name} game={game} />
        ))}
      </List>
    </Container>
  );
}

export const getStaticProps: GetStaticProps<{
  summary: ReadonlyArray<GameSummary>;
}> = () =>
  import("@/src/typed-summary-data").then((_) => ({
    props: { summary: _.GameSummaryData },
  }));
