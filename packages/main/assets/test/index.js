const lorem =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
const l1 =
  'Прежде всего, экономическая повестка сегодняшнего дня прекрасно подходит для реализации новых принципов формирования материально-технической и кадровой базы. С учётом сложившейся международной обстановки, сплочённость команды профессионалов предполагает независимые способы реализации анализа существующих паттернов поведения. Равным образом, убеждённость некоторых оппонентов прекрасно подходит для реализации переосмысления внешнеэкономических политик. Ясность нашей позиции очевидна: современная методология разработки позволяет выполнить важные задания по разработке приоретизации разума над эмоциями. Есть над чем задуматься: активно развивающиеся страны третьего мира обнародованы. Задача организации, в особенности же синтетическое тестирование однозначно фиксирует необходимость дальнейших направлений развития. Банальные, но неопровержимые выводы, а также предприниматели в сети интернет ограничены исключительно образом мышления. Сложно сказать, почему ключевые особенности структуры проекта, которые представляют собой яркий пример континентально-европейского типа политической культуры, будут подвергнуты целой серии независимых исследований. Учитывая ключевые сценарии поведения, новая модель организационной деятельности представляет собой интересный эксперимент проверки форм воздействия! Предварительные выводы неутешительны: понимание сути ресурсосберегающих технологий прекрасно подходит для реализации инновационных методов управления процессами! Кстати, интерактивные прототипы рассмотрены исключительно в разрезе маркетинговых и финансовых предпосылок! Прежде всего, выбранный нами инновационный путь обеспечивает широкому кругу (специалистов) участие в формировании стандартных подходов. Для современного мира глубокий уровень погружения позволяет выполнить важные задания по разработке глубокомысленных рассуждений.';
const lineWidth = 1536;
const lineHeight = 128;
const maxWidth = 8640;
const total = 6;

const text = () => {
  const maxHeight = total * lineHeight;
  const canvas = document.querySelector('canvas');
  canvas.width = lineWidth;
  canvas.height = total * lineHeight;
  const dest = canvas.getContext('2d');
  const offscreen = new OffscreenCanvas(maxWidth * 2, lineHeight);
  const ctx = offscreen.getContext('2d');
  ctx.font = 'bold 120px sans';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.fillText(l1, 0, lineHeight / 2);
  let pos = 0;
  const drawFrame = () => {
    dest.clearRect(0, 0, canvas.width, canvas.height);
    for (let line = 0; line < total; line += 1) {
      const sx = pos + (line - 1) * lineWidth;
      const width = Math.min(lineWidth, maxWidth - line * lineWidth);
      dest.drawImage(offscreen, sx, 0, width, lineHeight, 0, line * lineHeight, width, lineHeight);
    }
    pos += 1;
    pos %= maxWidth;
    window.requestAnimationFrame(drawFrame);
  };
  window.requestAnimationFrame(drawFrame);
};

const ribbon = () => {
  const canvas = document.querySelector('canvas');
  canvas.width = lineWidth;
  canvas.height = total * lineHeight;

  const dest = canvas.getContext('2d');
  const offscreen = new OffscreenCanvas(maxWidth, lineHeight);
  const W = maxWidth;
  const H = lineHeight;
  const ctx = offscreen.getContext('2d');

  const copyFrame = () => {
    for (let line = 0; line < total; line += 1) {
      const sx = line * lineWidth;
      const width = Math.min(lineWidth, maxWidth - line * lineWidth);
      dest.drawImage(
        offscreen,
        line * lineWidth,
        0,
        width,
        lineHeight,
        0,
        line * lineHeight,
        width,
        lineHeight,
      );
    }
  };

  class Particle {
    constructor() {
      //location on the canvas
      this.location = {x: Math.random() * W, y: Math.random() * H};
      //radius - lets make this 0
      this.radius = 0;
      //speed
      this.speed = 3;
      //steering angle in degrees range = 0 to 360
      this.angle = Math.random() * 360;
      //colors
      const r = Math.round(Math.random() * 255);
      const g = Math.round(Math.random() * 255);
      const b = Math.round(Math.random() * 255);
      const a = Math.random();
      this.rgba = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
    }
  }

  const particles = [];
  for (let i = 0; i < 25; i++) {
    particles.push(new Particle());
  }

  //Lets draw the particles
  function draw() {
    //re-paint the BG
    //Lets fill the canvas black
    //reduce opacity of bg fill.
    //blending time
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.fillStyle = 'white';
      ctx.fillRect(p.location.x, p.location.y, p.radius, p.radius);

      //Lets move the particles
      //So we basically created a set of particles moving in random direction
      //at the same speed
      //Time to add ribbon effect
      for (let n = 0; n < particles.length; n += 1) {
        const p2 = particles[n];
        //calculating distance of particle with all other particles
        const yd = p2.location.y - p.location.y;
        const xd = p2.location.x - p.location.x;
        const distance = Math.sqrt(xd * xd + yd * yd);
        //draw a line between both particles if they are in 200px range
        if (distance < 200) {
          ctx.beginPath();
          ctx.lineWidth = 1;
          ctx.moveTo(p.location.x, p.location.y);
          ctx.lineTo(p2.location.x, p2.location.y);
          ctx.strokeStyle = p.rgba;
          ctx.stroke();
          //The ribbons appear now.
        }
      }

      //We are using simple vectors here
      //New x = old x + speed * cos(angle)
      p.location.x = p.location.x + p.speed * Math.cos((p.angle * Math.PI) / 180);
      //New y = old y + speed * sin(angle)
      p.location.y = p.location.y + p.speed * Math.sin((p.angle * Math.PI) / 180);
      //You can read about vectors here:
      //http://physics.about.com/od/mathematics/a/VectorMath.htm

      if (p.location.x < 0) p.location.x = W;
      if (p.location.x > W) p.location.x = 0;
      if (p.location.y < 0) p.location.y = H;
      if (p.location.y > H) p.location.y = 0;
    }
    copyFrame();
    window.requestAnimationFrame(draw);
  }

  window.requestAnimationFrame(draw);
};

onload = text;
