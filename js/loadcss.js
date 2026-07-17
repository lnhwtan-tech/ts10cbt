const base = "/ts10cbt/";

const links = [
  "css/variables.css",
  "css/layout.css",
  "css/components.css",
  "css/charts.css",
  "css/animations.css",
  "css/responsive.css",
  "css/ios26.css" 
];

function loadCSS() {
    links.forEach(href => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = base + href;
        document.head.appendChild(link);
    });
}

loadCSS();