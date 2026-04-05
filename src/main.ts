import { Game } from './game/Game';

const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;
if (!canvas) throw new Error('Canvas element #canvas not found');

const game = new Game(canvas);
game.start();
