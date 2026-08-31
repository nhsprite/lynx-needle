// Demo tool catalogue: six tools, which also exercises the engine's
// retrieval head (only the top-5 are rendered per turn when > 5 declared).

import type { NeedleTool, NeedleToolHandler } from 'lynx-needle'

export const DEMO_SYSTEM = 'You are an on-device assistant for a smart home.'

export const DEMO_TOOLS: NeedleTool[] = [
  {
    name: 'set_lights',
    description: "Turn a room's lights on or off and set brightness",
    parameters: {
      type: 'object',
      properties: {
        room: { type: 'string', description: 'which room to control' },
        on: { type: 'boolean' },
        brightness: { type: 'integer', minimum: 0, maximum: 100 },
      },
      required: ['room', 'on'],
    },
  },
  {
    name: 'get_weather',
    description: 'Get the current weather for a city',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'city name' },
      },
      required: ['city'],
    },
  },
  {
    name: 'play_music',
    description: 'Play a song, artist or playlist on a speaker',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'what to play' },
        speaker: { type: 'string', description: 'which speaker' },
      },
      required: ['query'],
    },
  },
  {
    name: 'set_thermostat',
    description: 'Set the target temperature of the thermostat',
    parameters: {
      type: 'object',
      properties: {
        temperature_c: { type: 'number', minimum: 10, maximum: 32 },
      },
      required: ['temperature_c'],
    },
  },
  {
    name: 'create_reminder',
    description: 'Create a reminder with a title and a due time',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        due: { type: 'string', description: 'ISO-like time string' },
      },
      required: ['title', 'due'],
    },
  },
  {
    name: 'send_message',
    description: 'Send a text message to a contact',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['to', 'text'],
    },
  },
]

// Handlers simulate the device side; in a real app these would call
// NativeModules / platform APIs.
export const DEMO_HANDLERS: Record<string, NeedleToolHandler> = {
  set_lights: ({ room, on, brightness }) => ({
    room,
    on,
    brightness: on ? brightness ?? 100 : 0,
    applied: true,
  }),
  get_weather: ({ city }) => ({ city, temp_c: 27, sky: 'clear' }),
  play_music: ({ query, speaker }) => ({
    query,
    speaker: speaker ?? 'living room',
    playing: true,
  }),
  set_thermostat: ({ temperature_c }) => ({
    temperature_c,
    applied: true,
  }),
  create_reminder: ({ title, due }) => ({ title, due, created: true }),
  send_message: ({ to, text }) => ({ to, text, sent: true }),
}

export const PRESET_QUERIES = [
  'dim the living room to 30',
  "what's the weather in Lagos?",
  'play some jazz on the kitchen speaker',
  'set the thermostat to 22 degrees',
  'remind me to water the plants at 6pm',
  'text Maya: dinner is ready',
  'tell me a joke', // off-topic: the model should refuse
]

export const EXTRACT_DEMO_TEXT =
  'Invoice from Acme Corp, $1,200.00, due 2026-09-01'

export const EXTRACT_DEMO_SCHEMA: NeedleTool = {
  name: 'Invoice',
  description: 'An invoice record',
  parameters: {
    type: 'object',
    properties: {
      vendor: { type: 'string' },
      total: { type: 'number' },
      due_date: { type: 'string' },
    },
    required: ['vendor', 'total', 'due_date'],
  },
}
