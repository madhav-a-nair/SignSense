import { useEffect, useRef, useState } from "react";
import "./HomePage.css";
import logo from "../assets/SignSenseLogo.png";
import shutter from "../assets/shutter_icon.png";
import alphabets from "../assets/alphabets.png";
import start_speaking from "../assets/start_speaking.png";
import start_signing from "../assets/start_signing.png";
import stop_speaking from "../assets/stop_speaking.png";
import stop_signing from "../assets/stop_signing.png";
import ReactSwitch from "react-switch";

function HomePage() {
  const [error, setError] = useState(false);

  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState();
  const [languages, setLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState();
  const [cameras, setCameras] = useState([]);
  const [cameraNames, setCameraNames] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState();
  const [speed, setSpeed] = useState();

  const [transcription, setTranscription] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [transcriptionTrans, setTranscriptionTrans] = useState("");
  const [autocomplete, setAutocomplete] = useState(false)
  const [alphabetSymbols, setAlphabetSymbols] = useState(true);
  const [fontSize, setFontSize] = useState(true);
  const [context, setContext] = useState('general conversation')

  const videoRef = useRef(null);
  const outputRef = useRef(null);
  const suggestion = useRef(null);
  const outputTransRef = useRef(null);
  const speechRef = useRef(null);
  const speechTransRef = useRef(null);
  const bbRef = useRef(null);
  const shutterRef = useRef(null);
  const recognitionRef = useRef(null);
  const scanButton = useRef(null);
  const autocompleteSwitch = useRef(null);

  const startRecognition = () => {
    if (recognitionRef.current && !isRecording) {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const stopRecognition = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  var timerCount = 0;
  var prevScanBtnStatus = "false";
  var scanFailedCount = 0;

  useEffect(() => {
    localStorage.setItem("chat_history", JSON.stringify([]));
    navigator.permissions.query({ name: "camera" }).then(function(result) {
      if (result.state !== 'granted') {
        alert('Camera access denied')
      }
    });
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
    setError(true);

    fetch("https://engaged-aviary-441913-v1.el.r.appspot.com")
      .then((r) => {
        setError(false);
        fetch("https://engaged-aviary-441913-v1.el.r.appspot.com/models").then((res) => {
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
        fetch("https://engaged-aviary-441913-v1.el.r.appspot.com/languages").then((res) => {
          res.json().then((r) => {
            setLanguages(r.sort());
            if (localStorage.getItem("preferred_language") != null) {
              setSelectedLanguage(localStorage.getItem("preferred_language"));
            } else {
              setSelectedLanguage("English");
              localStorage.setItem("preferred_language", "English");
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

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Your browser does not support the Web Speech API.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");
      setTranscription(transcript);
      fetch("https://engaged-aviary-441913-v1.el.r.appspot.com/translate", {
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: transcript,
          to: localStorage.getItem("preferred_language"),
        }),
      }).then((res) => {
        res.json().then((r) => {
          setTranscriptionTrans(r.text);
        });
      });
    };

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (speechRef.current.textContent != "Start speaking...") {
        var new_list = JSON.parse(localStorage.getItem("chat_history"));
        let new_item = {
          type: "Speech",
          text: speechRef.current.textContent,
          translation: speechTransRef.current.textContent,
        };
        new_list.push(new_item);
        localStorage.setItem("chat_history", JSON.stringify(new_list));
      }
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const sendFrame = async () => {
    if (scanFailedCount >= 10) {
      scanFailedCount = 0;
      setIsScanning(false);
      var new_list = JSON.parse(localStorage.getItem("chat_history"));
      new_list.push({
        type: "Sign",
        text: outputRef.current.textContent,
        translation: outputTransRef.current.textContent,
      });
      suggestion.current.textContent = '';
      localStorage.setItem("chat_history", JSON.stringify(new_list));
    }
    if (
      timerCount % (localStorage.getItem("preferred_speed") / 0.5) == 0 &&
      scanButton.current.alt === "true"
    ) {
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
      fetch("https://engaged-aviary-441913-v1.el.r.appspot.com/predict", {
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
    } else if (scanButton.current.alt === "false") {
      prevScanBtnStatus = "false";
    }
    timerCount++;
  };

  const createBB = async (data) => {
    let bb = bbRef.current;
    let videoX =
      videoRef.current.getBoundingClientRect().left.toString() + "px";
    let videoY = videoRef.current.getBoundingClientRect().top.toString() + "px";
    if (data.status == 202) {
      let [newX1, newY1, newX2, newY2] = scaleBoundingBox(
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
      setTimeout(() => {
        bb.style.visibility = "hidden";
      }, 300);
    } else {
      bb.style.visibility = "hidden";
    }
  };

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
      if (prevScanBtnStatus === "false") {
        outputRef.current.textContent = "Start signing...";
        prevScanBtnStatus = "true";
      }
      if (data.prediction === "BACKSPACE") {
        if (outputRef.current.textContent !== "Start signing...") {
          outputRef.current.textContent = outputRef.current.textContent.slice(
            0,
            -1
          );
        }

        if (outputRef.current.textContent.length === 0) {
          outputRef.current.textContent = "Start signing...";
        }

        if (suggestion.current.textContent != "") {
          suggestion.current.textContent = "";
        }
      } else if (data.prediction === "SPACE") {
        if (suggestion.current.textContent == "") {
          if (outputRef.current.textContent == "") {
            outputRef.current.textContent = outputRef.current.textContent;
          } else if (outputRef.current.textContent.at(-1) == " ") {
            outputRef.current.textContent = outputRef.current.textContent;
          } else {
            outputRef.current.textContent = outputRef.current.textContent + " ";
            if (autocompleteSwitch.current.props.checked == true) {
              
              if (
                outputRef.current.textContent.split(" ").filter((x) => {
                  return x != "";
                }).length >= 2
              ) {
                fetch("https://engaged-aviary-441913-v1.el.r.appspot.com/suggest", {
                  method: "post",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    context: context,
                    text: outputRef.current.textContent,
                  }),
                }).then(async (res) => {

                  if (outputRef.current.textContent.at(-1) == " ") {
                    res.json().then((r) => {
                      let suggestions = r.suggestions.filter((x) => {
                        if (x != "") {
                          return x;
                        }
                      });
                      suggestion.current.textContent = suggestions[1];
                      if (localStorage.getItem("suggestion_done") != "done") {
                        localStorage.setItem("suggestion_done", "done");
                      }
                    });
                  }
                });
              }
            }
          }
        } else {
          outputRef.current.textContent =
            outputRef.current.textContent + suggestion.current.textContent;
          suggestion.current.textContent = "";
        }
      } else {
        if (outputRef.current.textContent !== "Start signing...") {
          outputRef.current.textContent =
            outputRef.current.textContent + data.prediction;
          suggestion.current.textContent = "";
        } else {
          outputRef.current.textContent = data.prediction;
        }
      }
      scanFailedCount = 0;
      translate(false);
    } else {
      setTimeout(()=>{
        scanFailedCount = scanFailedCount + 1;
      }, 5)
    }
  };

  const translate = async (explicit) => {
    if (
      localStorage.getItem("last_text") != outputRef.current.textContent ||
      explicit == true
    ) {
      if (outputRef.current.textContent == "Start signing...") {
        outputTransRef.current.textContent = "";
      } else {
        fetch("https://engaged-aviary-441913-v1.el.r.appspot.com/translate", {
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
            outputTransRef.current.textContent = r.text;
            localStorage.setItem("last_text", outputRef.current.textContent);
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

  function getCurrentDateTime() {
    const now = new Date();

    const options = {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    };

    const formatter = new Intl.DateTimeFormat("en-US", options);

    const parts = formatter.formatToParts(now);
    const dateParts = {
      day: parts.find((part) => part.type === "day").value,
      month: parts.find((part) => part.type === "month").value,
      year: parts.find((part) => part.type === "year").value,
      hour: parts.find((part) => part.type === "hour").value,
      minute: parts.find((part) => part.type === "minute").value,
      dayPeriod: parts.find((part) => part.type === "dayPeriod").value,
    };

    return `${dateParts.day} ${dateParts.month} ${dateParts.year} ${dateParts.hour}:${dateParts.minute} ${dateParts.dayPeriod}`;
  }

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
          <div className="top">
            <div className="logo-container">
              <img alt="logo" className="logo" src={logo}></img>
              <div className="speed-slider">
                <p className="slider-text">Sensing Speed</p>
                <input
                  className="slider"
                  type="range"
                  step={0.5}
                  value={speed}
                  onInput={(event) => {
                    localStorage.setItem("preferred_speed", event.target.value);
                    setSpeed(event.target.value);
                  }}
                  min={1}
                  max={2.5}
                  list="tickmarks"
                ></input>
                <datalist className="slider-ticks" id="tickmarks">
                  <option value={1} label="1s"></option>
                  <option value={1.5} label="1.5s"></option>
                  <option value={2} label="2s"></option>
                  <option value={2.5} label="2.5s"></option>
                </datalist>
              </div>
            </div>
            <div className="camera-container">
              <div className="camera">
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
            <div className="dropdown-container">
              <div className="model-dropdown">
                <p className="dropdown-text">Select Sign Language</p>
                <select
                  value={selectedModel}
                  className="dropdown"
                  onChange={(event) => {
                    localStorage.setItem("preferred_model", event.target.value);
                    setSelectedModel(event.target.value);
                  }}
                >
                  {models.map((i) => (
                    <option value={i}>{i}</option>
                  ))}
                </select>
              </div>
              <div className="translate-dropdown">
                <p className="dropdown-text">Translate To</p>
                <select
                  value={selectedLanguage}
                  className="dropdown"
                  onChange={(event) => {
                    localStorage.setItem(
                      "preferred_language",
                      event.target.value
                    );
                    setSelectedLanguage(event.target.value);
                    translate(true);
                  }}
                >
                  {languages.map((i) => (
                    <option value={i}>{i}</option>
                  ))}
                </select>
              </div>
              <div className="camera-dropdown">
                <p className="dropdown-text">Select Camera</p>
                <select
                  value={selectedCamera}
                  className="dropdown"
                  onChange={(event) => {
                    setSelectedCamera(event.target.value);
                    getVideo(event.target.value);
                  }}
                >
                  {cameras.map((i) => {
                    return (
                      <option value={i}>
                        {cameraNames[cameras.indexOf(i)]}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <div className="switch-container">
              <div className="switches">
                <div className="switch">
                  <ReactSwitch
                    activeBoxShadow=""
                    onColor="#005CC8"
                    checkedIcon={false}
                    uncheckedIcon={false}
                    onChange={(x) => {
                      setAlphabetSymbols(x);
                    }}
                    checked={alphabetSymbols}
                  ></ReactSwitch>
                  <p className="switch-text">Show Sign Alphabets</p>
                </div>
                <div className="switch">
                  <ReactSwitch
                    activeBoxShadow=""
                    onColor="#005CC8"
                    checkedIcon={false}
                    uncheckedIcon={false}
                    onChange={(x) => {
                      setFontSize(x);
                    }}
                    checked={fontSize}
                  ></ReactSwitch>
                  <p className="switch-text">Increase Font Size</p>
                </div>
                <div className="switch">
                  <ReactSwitch
                    ref={autocompleteSwitch}
                    activeBoxShadow=""
                    onColor="#005CC8"
                    checkedIcon={false}
                    uncheckedIcon={false}
                    onChange={(x) => {
                      setAutocomplete(x);
                      if (x === true) {
                        var prompt_ans = prompt("Please provide a clear and specific context, such as 'doctor consultation' or 'general conversation,' to ensure more accurate and relevant AI suggestions.", context)
                        if (prompt_ans !== null) {
                          setContext(prompt_ans)
                        } else {
                          setAutocomplete(false)
                        }
                      }
                    }}
                    checked={autocomplete}
                  ></ReactSwitch>
                  <p className="switch-text">Autocomplete</p>
                </div>
              </div>
              <div className="share-clear">
                <div
                  onClick={() => {
                    if (
                      JSON.parse(localStorage.getItem("chat_history")).length !=
                      0
                    ) {
                      
                      let content = JSON.parse(
                        localStorage.getItem("chat_history")
                      )
                        .map((x) => {
                          return (
                            x.type + " - " + x.text + " | " + x.translation
                          );
                        })
                        .join("\n");
                      content = content + "\n\nCreated on: " + getCurrentDateTime();
                      navigator.share({
                        title: "Sign Sense Chat",
                        text: content,
                      });
                    } else {
                      alert("No conversation to share");
                    }
                  }}
                  className="button"
                >
                  Share
                </div>
                <div
                  onClick={() => {
                    outputRef.current.textContent = "Start signing...";
                    outputTransRef.current.textContent = "";
                    suggestion.current.textContent = "";
                    setTranscription("");
                    setTranscriptionTrans("");
                    localStorage.setItem("chat_history", JSON.stringify([]));
                  }}
                  className="button"
                >
                  Clear All
                </div>
              </div>
            </div>
          </div>
          <div className="bottom">
            {alphabetSymbols ? (
              <div className="alphabets">
                <img src={alphabets} className="alphabets-image"></img>
              </div>
            ) : (
              ""
            )}
            <div
              className="text-container"
              style={{ height: alphabetSymbols ? "77%" : "100%" }}
            >
              <div className="sign-container">
                <div className="sign-text">
                  <img
                    onClick={() => {
                      if (isScanning == true) {
                        setIsScanning(false);
                        if (
                          outputRef.current.textContent != "Start signing..."
                        ) {
                          var new_list = JSON.parse(
                            localStorage.getItem("chat_history")
                          );
                          new_list.push({
                            type: "Sign",
                            text: outputRef.current.textContent,
                            translation: outputTransRef.current.textContent,
                          });
                          localStorage.setItem(
                            "chat_history",
                            JSON.stringify(new_list)
                          );
                        }
                      } else {
                        setIsScanning(true);
                        setIsRecording(false);
                        if (
                          speechRef.current.textContent != "Start speaking..."
                        ) {
                          var new_list = JSON.parse(
                            localStorage.getItem("chat_history")
                          );
                          if (
                            new_list[new_list.length - 1] ==
                            {
                              type: "Speech",
                              text: speechRef.current.textContent,
                              translation: speechTransRef.current.textContent,
                            }
                          ) {
                            new_list.push({
                              type: "Speech",
                              text: speechRef.current.textContent,
                              translation: speechTransRef.current.textContent,
                            });
                            localStorage.setItem(
                              "chat_history",
                              JSON.stringify(new_list)
                            );
                          }
                        }
                      }
                    }}
                    ref={scanButton}
                    alt={isScanning ? "true" : "false"}
                    className="text-icon"
                    src={isScanning ? stop_signing : start_signing}
                  ></img>
                  <div className="sign-text-values">
                    <div className="sign-text-row">
                      <p
                        className="sign-text-original"
                        style={{ fontSize: fontSize ? "1.7em" : "1.3em" }}
                        ref={outputRef}
                      >
                        Start signing...
                      </p>
                      <i className="sign-text-suggestion" ref={suggestion}></i>
                    </div>
                    <p
                      style={{ fontSize: fontSize ? "1.7em" : "1.3em" }}
                      className="sign-text-translated"
                      ref={outputTransRef}
                    ></p>
                  </div>
                </div>
                <div className="sign-controls"></div>
              </div>
              <div className="talk-container">
                <div className="talk-text">
                  <img
                    onClick={() => {
                      if (isRecording == false) {
                        startRecognition();
                        setIsRecording(true);
                        setIsScanning(false);
                        if (
                          outputRef.current.textContent != "Start signing..."
                        ) {
                          var new_list = JSON.parse(
                            localStorage.getItem("chat_history")
                          );
                          if (
                            new_list[new_list.length - 1] !=
                            {
                              type: "Sign",
                              text: outputRef.current.textContent,
                              translation: outputTransRef.current.textContent,
                            }
                          ) {
                            new_list.push({
                              type: "Sign",
                              text: outputRef.current.textContent,
                              translation: outputTransRef.current.textContent,
                            });
                            localStorage.setItem(
                              "chat_history",
                              JSON.stringify(new_list)
                            );
                          }
                        }
                      } else {
                        stopRecognition();
                        setIsRecording(false);
                        if (
                          speechRef.current.textContent != "Start speaking..."
                        ) {
                          var new_list = JSON.parse(
                            localStorage.getItem("chat_history")
                          );
                          new_list.push({
                            type: "Speech",
                            text: speechRef.current.textContent,
                            translation: speechTransRef.current.textContent,
                          });
                          localStorage.setItem(
                            "chat_history",
                            JSON.stringify(new_list)
                          );
                        }
                      }
                    }}
                    className="text-icon"
                    src={isRecording ? stop_speaking : start_speaking}
                  ></img>
                  <div>
                    <p
                      ref={speechRef}
                      className="talk-text-original"
                      style={{ fontSize: fontSize ? "1.7em" : "1.3em" }}
                    >
                      {transcription || "Start speaking..."}
                    </p>
                    <p
                      ref={speechTransRef}
                      className="talk-text-translated"
                      style={{ fontSize: fontSize ? "1.7em" : "1.3em" }}
                    >
                      {transcriptionTrans}
                    </p>
                  </div>
                </div>
                <div className="talk-controls"></div>
              </div>
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
