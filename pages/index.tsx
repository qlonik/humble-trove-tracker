import * as A from "@effect-ts/core/Collections/Immutable/Array";
import * as T from "@effect-ts/core/Effect";
import { pipe } from "@effect-ts/core/Function";
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

import { FlexBox } from "@/components/FlexBox";
import type { GameSummary } from "@/src/summarize-data";
import { dataSummary } from "@/src/summarize-data";

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
  current: readonly [number, number | null];
}) {
  return (
    <FlexBox sx={{ mb: 2 }}>
      <FlexBox sx={{ mr: 1, flexDirection: "column", alignItems: "end" }}>
        <AvailabilityText>Available since</AvailabilityText>
        {end && <AvailabilityText>and until</AvailabilityText>}
      </FlexBox>
      <FlexBox sx={{ flexDirection: "column" }}>
        <AvailabilityText>{formatExistenceDate(start)}</AvailabilityText>
        {end && <AvailabilityText>{formatExistenceDate(end)}</AvailabilityText>}
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
          src="https://mui.com/static/images/cards/contemplative-reptile.jpg"
          alt={`thumbnail for "${game.name}" game`}
        />
      </ListItemAvatar>
      <ListItemText
        disableTypography
        primary={<Typography variant="h5">{game.name}</Typography>}
        secondary={<CurrentAvailability current={game.existence.current} />}
      />
    </ListItem>
  );
}

export default function Home({ summary }: { summary: A.Array<GameSummary> }) {
  const [unavailable, available] = A.partition_(
    summary,
    (x) => x.existence.current[1] === null
  );

  return (
    <Container>
      <Typography variant="h2" sx={{ ml: 2 }}>
        Currently available
      </Typography>
      <List>
        {available.map((game) => (
          <GameSummaryListItem key={game.name} game={game} />
        ))}
      </List>
      <Typography variant="h2" sx={{ ml: 2 }}>
        No longer available
      </Typography>
      <List>
        {unavailable.map((game) => (
          <GameSummaryListItem key={game.name} game={game} />
        ))}
      </List>
    </Container>
  );
}

export const getStaticProps: GetStaticProps<{
  summary: A.Array<GameSummary>;
}> = () =>
  pipe(
    dataSummary,
    T.map((summary) => ({ props: { summary } })),
    T.runPromise
  );
