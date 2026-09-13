function clone(value) {
  return structuredClone(value);
}

function matches(row, filters) {
  return filters.every(({ field, value }) => {
    if (row[field] === value) return true;
    if (row[field] == null || value == null) return false;
    return String(row[field]) === String(value);
  });
}

class FakeQuery {
  constructor(database, tableName) {
    this.database = database;
    this.tableName = tableName;
    this.operation = "select";
    this.payload = null;
    this.filters = [];
    this.ordering = null;
    this.rowLimit = null;
  }

  select() {
    return this;
  }

  insert(payload) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(field, value) {
    this.filters.push({ field, value });
    return this;
  }

  order(field, options = {}) {
    this.ordering = { field, ...options };
    return this;
  }

  limit(value) {
    this.rowLimit = value;
    return this;
  }

  single() {
    return this.execute(true);
  }

  then(resolve, reject) {
    return this.execute(false).then(resolve, reject);
  }

  async execute(single) {
    const table = this.database.tables[this.tableName];

    if (!table) {
      return {
        data: null,
        error: { message: `Unknown fake table: ${this.tableName}` }
      };
    }

    let resultRows = [];

    if (this.operation === "select") {
      resultRows = table.filter(row => matches(row, this.filters));
    }

    if (this.operation === "insert") {
      const incoming = Array.isArray(this.payload)
        ? this.payload
        : [this.payload];

      resultRows = incoming.map(item => {
        const row = clone(item);

        if (!row.id) row.id = this.database.nextId(this.tableName);
        if (this.tableName === "game_events" && !row.created_at) {
          row.created_at = this.database.nextTimestamp();
        }

        table.push(row);
        return row;
      });
    }

    if (this.operation === "update") {
      resultRows = table.filter(row => matches(row, this.filters));
      resultRows.forEach(row => Object.assign(row, clone(this.payload)));
    }

    if (this.operation === "delete") {
      resultRows = table.filter(row => matches(row, this.filters));
      this.database.tables[this.tableName] = table.filter(
        row => !matches(row, this.filters)
      );
    }

    if (this.ordering) {
      const { field, ascending = true, nullsFirst = false } = this.ordering;
      resultRows = [...resultRows].sort((left, right) => {
        const a = left[field];
        const b = right[field];

        if (a == null && b == null) return 0;
        if (a == null) return nullsFirst ? -1 : 1;
        if (b == null) return nullsFirst ? 1 : -1;

        const comparison = a < b ? -1 : a > b ? 1 : 0;
        return ascending ? comparison : -comparison;
      });
    }

    if (this.rowLimit != null) {
      resultRows = resultRows.slice(0, this.rowLimit);
    }

    const data = clone(resultRows);

    if (!single) return { data, error: null };

    if (data.length !== 1) {
      return {
        data: null,
        error: {
          code: "PGRST116",
          message: `Expected one row, received ${data.length}`
        }
      };
    }

    return { data: data[0], error: null };
  }
}

export function defaultGame(overrides = {}) {
  return {
    id: "game-1",
    game_code: "TEST001",
    away_team: "AWAY",
    home_team: "HOME",
    away_score: 0,
    home_score: 0,
    inning: 1,
    inning_half: "top",
    balls: 0,
    strikes: 0,
    outs: 0,
    runner_first: false,
    runner_second: false,
    runner_third: false,
    away_pitcher_number: "",
    away_pitcher_name: "",
    away_pitch_count: 0,
    home_pitcher_number: "",
    home_pitcher_name: "",
    home_pitch_count: 0,
    current_batter_number: "",
    current_batter_name: "",
    away_current_batter_slot: 1,
    home_current_batter_slot: 1,
    away_pitch_sequence: [],
    home_pitch_sequence: [],
    away_pa_start_pitch_count: null,
    home_pa_start_pitch_count: null,
    status: "live",
    ...overrides
  };
}

export function rosterPlayer(overrides = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    game_code: "TEST001",
    team_side: "away",
    batting_order: 1,
    jersey_number: "1",
    player_name: "Player One",
    position: "CF",
    roster_status: "active",
    ...overrides
  };
}

export function createFakeSupabase(seed = {}) {
  let idCounter = 1000;
  let timestampCounter = 0;

  const database = {
    tables: {
      live_games: [clone(seed.game || defaultGame())],
      game_rosters: clone(seed.rosters || []),
      game_events: clone(seed.events || [])
    },
    nextId(tableName) {
      idCounter += 1;
      return `${tableName}-${idCounter}`;
    },
    nextTimestamp() {
      timestampCounter += 1;
      return new Date(Date.UTC(2026, 8, 13, 12, 0, timestampCounter)).toISOString();
    }
  };

  const client = {
    from(tableName) {
      return new FakeQuery(database, tableName);
    },
    channel() {
      return {
        on() {
          return this;
        },
        subscribe() {
          return this;
        }
      };
    }
  };

  return { client, database };
}
