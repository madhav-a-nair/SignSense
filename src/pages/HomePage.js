import { useEffect, useRef, useState } from "react";
import "./HomePage.css";
import logo from "../assets/SignSenseLogo.png";
import shutter from '../assets/shutter_icon.png'

function HomePage() {
  const [error, setError] = useState(true);

  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState();
  const [languages, setLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState();
  const [cameras, setCameras] = useState([]);
  const [cameraNames, setCameraNames] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState();
  const [speed, setSpeed] = useState();

  const videoRef = useRef(null);
  const outputRef = useRef(null);
  const suggestion = useRef(null);
  const outputTransRef = useRef(null);
  const bbRef = useRef(null);
  const shutterRef = useRef(null);
  const autocomplete = useRef(null);
  const tooltip = useRef(null);

  var timerCount = 0;

  useEffect(() => {
    navigator.permissions.query({ name: "camera" });
    navigator.mediaDevices.enumerateDevices().then((res) => {
      let camerasList = [];
      let cameraNamesList = [];
      res.map((cam) => {
        if (cam.kind == "videoinput") {
          cameraNamesList.push(cam.label);
          camerasList.push(cam.deviceId);
        }
      });
      setCameraNames(cameraNamesList);
      setCameras(camerasList);
      setSelectedCamera(camerasList[0]);
      getVideo(camerasList[0]);
    });

    if (localStorage.getItem("preferred_speed") != null) {
      setSpeed(localStorage.getItem("preferred_speed"));
    } else {
      setSpeed(2);
    }
    setError(false);

    fetch("http://127.0.0.1:5000")
      .then((r) => {
        fetch("http://127.0.0.1:5000/models").then((res) => {
          res.json().then((r) => {
            setModels(r);
            if (localStorage.getItem("preferred_model") != null) {
              setSelectedModel(localStorage.getItem("preferred_model"));
            } else {
              setSelectedModel(r[0]);
              localStorage.setItem("preferred_model", r[0]);
            }
          });
        });
        fetch("http://127.0.0.1:5000/languages").then((res) => {
          res.json().then((r) => {
            setLanguages(r.sort());
            if (localStorage.getItem("preferred_language") != null) {
              setSelectedLanguage(localStorage.getItem("preferred_language"));
            } else {
              setSelectedLanguage("English");
              localStorage.setItem("preferred_language", 'English');
            }
          });
        });

        setInterval(() => {
          sendFrame();
        }, 500);
      })
      .catch((e) => {
        setError(true);
      });
  }, []);

  const sendFrame = async () => {
    if (timerCount % (localStorage.getItem("preferred_speed") / 0.5) == 0) {
      const video = videoRef.current;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0);

      const imageData = canvas.toDataURL("image/jpeg");

      var body = JSON.stringify({
        image: imageData,
        model: localStorage.getItem("preferred_model"),
      });
      fetch("http://127.0.0.1:5000/predict", {
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        body: body,
      })
        .then(async (res) => {
          if (res.status == 500) {
            console.warn(await res.text());
          } else {
            res.json().then((r) => {
              processOutput(r);
              createBB(r);
            });
          }
        })
        .catch((err) => {});
    }
    timerCount++;
  };


  const createBB = async (data) => {
    let bb = bbRef.current;
    let videoX = videoRef.current.getBoundingClientRect().left.toString() + "px";
    let videoY =
      videoRef.current.getBoundingClientRect().top.toString() + "px";
    if (data.status == 202) {
      let [newX1,
        newY1,
        newX2,
        newY2] = scaleBoundingBox(
          data.bounding_box.x1,
          data.bounding_box.y1,
          data.bounding_box.x2,
          data.bounding_box.y2,
          data.img_shape.w,
          data.img_shape.h,
          Math.round(videoRef.current.getBoundingClientRect().width),
          Math.round(videoRef.current.getBoundingClientRect().height)
        );
      bb.style.visibility = "visible";
      bb.style.left = "calc(" + videoX + " + " + (newX1 - 20) + "px)";
      bb.style.top = "calc(" + videoY + " + " + (newY1 - 20) + "px)";
      bb.style.width = newX2 - newX1 + 40 + "px";
      bb.style.height = newY2 - newY1 + 40 + "px";
      shutterRef.current.style.width =
        Math.min((newX2 - newX1 + 40) / 1.5, (newY2 - newY1 + 40) / 1.5) + "px";
      shutterRef.current.style.height = shutterRef.current.style.width;
      setTimeout(()=>{
        bb.style.visibility = "hidden";
      }, 300)
    } else {
      bb.style.visibility = "hidden";
    }
    
  }


  function scaleBoundingBox(
    x1,
    y1,
    x2,
    y2,
    originalWidth,
    originalHeight,
    newWidth,
    newHeight
  ) {
    // Calculate the scaling factors
    let scaleX = newWidth / originalWidth;
    let scaleY = newHeight / originalHeight;

    // Adjust the bounding box coordinates
    let newX1 = x1 * scaleX;
    let newY1 = y1 * scaleY;
    let newX2 = x2 * scaleX;
    let newY2 = y2 * scaleY;

    return [newX1, newY1, newX2, newY2];
  }

  const processOutput = async (data) => {
    if (data.status == 202) {
      if (data.prediction === "BACKSPACE") {
        outputRef.current.textContent = outputRef.current.textContent.slice(
          0,
          -1
        );


        if (suggestion.current.textContent != '') {
          suggestion.current.textContent = '';
          tooltip.current.style.visibility = "hidden";
        }


      } else if (data.prediction === "SPACE") {

        if (suggestion.current.textContent == "") {
          if (outputRef.current.textContent == '') {
            outputRef.current.textContent = outputRef.current.textContent;
          } else if (outputRef.current.textContent.at(-1) == " ") {
            outputRef.current.textContent = outputRef.current.textContent;
          } else {
            outputRef.current.textContent = outputRef.current.textContent + ' ';
            if (autocomplete.current.checked == true) {
              if (
                outputRef.current.textContent.split(" ").filter((x) => {
                  return x != "";
                }).length >= 2
              ) {
                fetch("http://127.0.0.1:5000/suggest", {
                  method: "post",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    text: outputRef.current.textContent,
                  }),
                }).then(async (res) => {
                  res.json().then((r) => {
                    let suggestions = r.suggestions;
                    suggestion.current.textContent = suggestions[0];
                    if (localStorage.getItem("suggestion_done") != "done") {
                      tooltip.current.style.top =
                        suggestion.current.getBoundingClientRect().top +
                        50 +
                        "px";
                      tooltip.current.style.visibility = "visible";
                      localStorage.setItem("suggestion_done", "done");
                    }
                  });
                });
              }
            }
          }
        } else {
          tooltip.current.style.visibility = "hidden";
          outputRef.current.textContent =
            outputRef.current.textContent + suggestion.current.textContent;
          suggestion.current.textContent = "";
        }


      } else {
        outputRef.current.textContent =
          outputRef.current.textContent + data.prediction;
        suggestion.current.textContent = "";
      }
      translate(false);
    }
  };

  const translate = async (explicit) => {
    if (
      localStorage.getItem("last_text") != outputRef.current.textContent || explicit == true
    ) {
      if (outputRef.current.textContent == "") {
        outputTransRef.current.textContent = "_";
      } else {
        fetch("http://127.0.0.1:5000/translate", {
          method: "post",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: outputRef.current.textContent,
            to: localStorage.getItem("preferred_language"),
          }),
        }).then(async (res) => {
          res.json().then((r) => {
            outputTransRef.current.textContent = r.text + "_";
            localStorage.setItem(
              "last_text",
              outputRef.current.textContent
            );
          });
        });
      }
    }
  };

  const getVideo = async (camID) => {
    navigator.mediaDevices
      .getUserMedia({
        video: {
          deviceId: {
            exact: camID,
          },
        },
        audio: false,
      })
      .then((stream) => {
        let video = videoRef.current;
        video.srcObject = stream;
        video.play();
      })
      .catch((err) => {});
  };

  return (
    <>
      {error == true ? (
        <div className="error">
          <img alt="logo" className="error-logo" src={logo}></img>
          <p className="error-text">Loading...</p>
        </div>
      ) : (
        ""
      )}
      {error != true ? (
        <div className="main">
          <div className="left">
            <img alt="logo" className="logo" src={logo}></img>
            <p className="speed-slider-text">Sensing Speed</p>
            <input
              className="speed-slider"
              type="range"
              step={0.5}
              value={speed}
              onInput={(event) => {
                localStorage.setItem("preferred_speed", event.target.value);
                setSpeed(event.target.value);
              }}
              min={0.5}
              max={2.5}
              list="tickmarks"
            ></input>
            <datalist className="speed-slider-ticks" id="tickmarks">
              <option value={0.5} label="0.5s"></option>
              <option value={1} label="1s"></option>
              <option value={1.5} label="1.5s"></option>
              <option value={2} label="2s"></option>
              <option value={2.5} label="2.5s"></option>
            </datalist>
            <div className="autocomplete-checkbox">
              <input
                ref={autocomplete}
                className="checkbox"
                onInput={(e) => {}}
                type="checkbox"
              ></input>
              Enable Autocomplete
            </div>
            <p className="model-selector-text">Select Sign Language</p>
            <select
              value={selectedModel}
              className="model-selector"
              onChange={(event) => {
                localStorage.setItem("preferred_model", event.target.value);
                setSelectedModel(event.target.value);
              }}
            >
              {models.map((i) => (
                <option value={i}>{i}</option>
              ))}
            </select>
            <p className="language-selector-text">Translate To</p>
            <select
              value={selectedLanguage}
              className="language-selector"
              onChange={(event) => {
                localStorage.setItem("preferred_language", event.target.value);
                setSelectedLanguage(event.target.value);
                translate(true);
              }}
            >
              {languages.map((i) => (
                <option value={i}>{i}</option>
              ))}
            </select>
            <p className="language-selector-text">Select Camera</p>
            <select
              value={selectedCamera}
              className="language-selector"
              onChange={(event) => {
                setSelectedCamera(event.target.value);
                getVideo(event.target.value);
              }}
            >
              {cameras.map((i) => {
                return (
                  <option value={i}>{cameraNames[cameras.indexOf(i)]}</option>
                );
              })}
            </select>
          </div>
          <div className="right">
            <div className="camera">
              <div className="buttons">
                <div
                  onClick={() => {
                    if (outputRef.current.textContent != "") {
                      navigator.share({
                        text:
                          outputRef.current.textContent +
                          " | " +
                          outputTransRef.current.textContent.replace("_", ""),
                        title: "Sign Sense",
                      });
                    }
                  }}
                  className="share-button"
                >
                  Share
                </div>
                <div
                  className="clear-all-button"
                  onClick={() => {
                    outputRef.current.textContent = "";
                    outputTransRef.current.textContent = "_";
                    suggestion.current.textContent = "";
                    tooltip.current.style.visibility = "hidden";
                  }}
                >
                  Clear All
                </div>
              </div>

              <div className="frame">
                <div
                  style={{ visibility: "hidden" }}
                  ref={bbRef}
                  className="bounding-box"
                >
                  <img ref={shutterRef} src={shutter}></img>
                </div>
                <video className="camera-ref" ref={videoRef}></video>
              </div>
            </div>
            <div className="text-output-section">
              <div className="text">
                <span ref={outputRef} className="text-output"></span>
                <span>
                  <p ref={suggestion} className="text-suggestions"></p>
                </span>
                <span className="text-output">_</span>
              </div>
              <div ref={tooltip} className="tooltip">
                <p className="tooltip-title">Autocomplete</p>
                <p className="tooltip-text">
                  <i>SPACE</i> to accept
                </p>
                <p className="tooltip-text">
                  <i>BACKSPACE</i> to reject
                </p>
              </div>
              <div className="text-output-divider"></div>
              <p ref={outputTransRef} className="text-translation">
                _
              </p>
            </div>
          </div>
        </div>
      ) : (
        ""
      )}
    </>
  );
}

export default HomePage;
