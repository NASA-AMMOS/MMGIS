const chrome = require("chromedriver");
const { Builder, Capabilities, By, Key, until } = require("selenium-webdriver");

const chalk = require("chalk");

let capabilities = Capabilities.chrome();

capabilities.set("chromeOptions", {
  args: [
    "--headless",
    "--no-sandbox",
    "window-size=1024,768",
    "--disable-gpu",
    "--log-level=3"
  ]
});

let browser = new Builder()
  .forBrowser("chrome")
  .withCapabilities(capabilities)
  .build();

browser.get("http://localhost:8888/?mission=MSL");

let interval = null;

let lastNumberCompleted = 0;
let timesOnLastCompleted = 0;
let maxTimesOnLastCompleted = 10;

setTimeout(() => {
  browser
    .findElement(By.tagName("body"))
    .sendKeys(Key.SHIFT + "t")
    .then(function() {
      browser
        .findElement(By.id("Test_Start"))
        .click()
        .then(function() {
          interval = setInterval(() => {
            browser
              .findElement(By.id("__Test_Results__"))
              .getText()
              .then(function(v) {
                process.stdout.write("\033[2J\u001b[0;0H");
                let split = v.split(",");
                process.stdout.write(
                  chalk.greenBright("\r   " + split[0] + "   \n")
                );
                process.stdout.write(
                  chalk.redBright("  " + split[1] + "   \n")
                );
                process.stdout.write(
                  chalk.white(
                    chalk.bgRgb(20, 20, 255)("  " + split[2] + "   \n")
                  )
                );

                let completionFraction = split[2].split(": ")[1];
                let cFSplit = completionFraction.split("/");
                if (cFSplit[0] == cFSplit[1]) {
                  clearInterval(interval);
                  //Get al the failed
                  browser
                    .findElements(By.css("#Test_Messages li.fail"))
                    .then(function(elements) {
                      process.stdout.write("\n");
                      var len = elements.length;
                      var captured = 0;
                      if (len === 0) {
                        process.stdout.write("\n" + "Done!\r\n");
                        browser.quit();
                      }
                      elements.forEach(function(element) {
                        element.getText().then(function(text) {
                          console.log(chalk.redBright("Failed: " + text));
                          captured++;
                          if (captured >= len) {
                            process.stdout.write("\n" + "Done!\r\n");
                            browser.quit();
                          }
                        });
                      });
                    });
                }
                if (cFSplit[0] === lastNumberCompleted) {
                  timesOnLastCompleted++;
                  if (timesOnLastCompleted >= maxTimesOnLastCompleted) {
                    process.stdout.write(
                      chalk.redBright("\n" + "Warning! Testing timed out.\r\n")
                    );
                    clearInterval(interval);
                    browser.quit();
                  }
                } else {
                  timesOnLastCompleted = 0;
                }
                lastNumberCompleted = cFSplit[0];
              });
          }, 1000);
        });
    });
}, 8000);
