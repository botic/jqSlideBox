/****************************************************************************
*  Copyright 2013 Philipp Naderer
*
*  Licensed under the Apache License, Version 2.0 (the "License");
*  you may not use this file except in compliance with the License.
*  You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
*  Unless required by applicable law or agreed to in writing, software
*  distributed under the License is distributed on an "AS IS" BASIS,
*  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*  See the License for the specific language governing permissions and
*  limitations under the License.
*****************************************************************************/

(function( $ ){
   $.fn.slidebox = function(options) {
      var settings = $.extend({
         prevId: null,
         nextId: null,
         positionVisible: true,
         positionSeparator: " | ",
         cacheSize: 4,
         ignorePixelRatio: false
      }, options);
      
      var devicePixelRatio = null;
      if (!settings.ignorePixelRatio) {
         devicePixelRatio = window.devicePixelRatio;
      }
      
      // Abort of no frames are available
      if (!settings.frames || !settings.width || !settings.height) {
         throw "Error during initialization of jqSlideBox: frames, width and height are required";
      }
      
      // Pre-fetching of images
      var CacheMgr = function() {
         var $cacheDiv = $("<div>").css({
            display: "none",
            position: "absolute",
            left: "-1000em",
            top: "-1000em",
            height: "1px",
            width: "1px"
         }).attr("class", "bs-cache");
         
         var $cacheImg = $("<img>").attr({
            alt: "",
            title: ""
         });
         
         $cacheDiv.appendTo("body");
         
         this.purge = function() {
            $cacheDiv.empty();
         };
         
         this.fill = function(from, count) {
            var recursiveFill = function(start, length) {
               // Abort the recursion
               if (start >= settings.frames.length || length <= 0) {
                  return;
               }
               
               // Check for high-res version
               if (devicePixelRatio && settings.frames[start]["src" + devicePixelRatio + "x"]) {
                  src = settings.frames[start]["src" + devicePixelRatio + "x"];
               } else {
                  src = src = settings.frames[start]["src"];
               }
               
               $cacheImg.clone().appendTo($cacheDiv).attr("src", src).load(function () {
                  recursiveFill(start + 1, length - 1);
               });
            };
            
            recursiveFill(from, count);
         };
         
         return this;
      };
      
      var SlideBox = function($container) {
         var self = this;
         var pos = 0;
         
         var $canvas = $("<div>").css({
            width: settings.width,
            height: settings.height,
            overflow: "hidden"
         }).addClass("bsCanvas").attr("role", "img");
         
         var $imageHolder = $("<img>").attr({
            src: "",
            alt: "",
            title: ""
         })
         
         $imageHolder.appendTo($canvas);
         
         var cacheMgr = new CacheMgr();
         cacheMgr.fill(0, settings.cacheSize);
         
         var $positionCurrent = $("<span>").addClass("current");
         var $positionSeparator = $("<span>").addClass("separator").html(settings.positionSeparator);
         var $positionMaximum = $("<span>").addClass("maximum");
         var $position = $("<div>").addClass("position").append($positionCurrent).append($positionSeparator).append($positionMaximum);
         
         var $figure = $("<figure>");
         var $caption = $("<figcaption>").addClass("caption");
         
         if (settings.positionVisible) {
            $position.appendTo($container);
         }
         
         this.setFrame = function(moveSteps) {
            pos = (moveSteps ? pos + moveSteps : 0);
            
            if (pos >= settings.frames.length) {
               pos = 0;
            } else if (pos < 0) {
               pos = settings.frames.length - 1;
            }
            
            var src = settings.frames[pos].src;
            
            // Check for high-res version
            if (devicePixelRatio && settings.frames[pos]["src" + devicePixelRatio + "x"]) {
               src = settings.frames[pos]["src" + devicePixelRatio + "x"];
            }

            // Updates the current frame (using <img> for better caching)
            var updateCanvas = function() {
               $imageHolder.attr({
                  alt: (settings.frames[pos].alt || ""),
                  title: (settings.frames[pos].title || ""),
                  src: src,
                  width:  settings.frames[pos].width || settings.width,
                  height: settings.frames[pos].height || settings.height
               });
               
               $positionCurrent.text(pos + 1);
            };
            
            // Use animations only on moves
            if (moveSteps) {
               $imageHolder.fadeTo(40, 0.85, function() {
                  updateCanvas();
                  $(this).fadeTo(70, 1, function() {
                     if (moveSteps > 0 && (pos + 1) % settings.cacheSize === 0) {
                        cacheMgr.purge();
                        cacheMgr.fill(pos + 1, settings.cacheSize);
                     }
                  })
               });
               
               if (typeof settings.onRefresh === "function") {
                  settings.onRefresh(pos, src);
               }
            } else {
               updateCanvas();
            }
            
            // Refresh the caption
            $caption.remove();
            if (settings.frames[pos].caption) {
               $caption.html(settings.frames[pos].caption).appendTo($figure);
            }
         };
         
         // Detect touch support and if, enable touch support
         if(('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch) {
            var touch = {
               time: -1,
               x: 0,
               y: 0
            };
            $canvas.on("touchstart", function(event) {
               var touchEvent = event.originalEvent.touches[0];
               touch.time = Date.now();
               touch.x = touchEvent.clientX;
               touch.y = touchEvent.clientY;
            });
            
            $canvas.on("touchend", function(event) {
               var touchEvent = event.originalEvent.changedTouches[0];
               
               // Only change frame if swipe was under 2000ms AND not primary in y dimension
               console.log(Math.abs((touchEvent.clientY - touch.y) / $canvas.height()))
               if (Date.now() - touch.time < 2000 && (Math.abs((touchEvent.clientY - touch.y) / $canvas.height()) < 0.15)) {
                  var swipeRatioX = (touchEvent.clientX - touch.x) / $canvas.width();
                  if (-1 < swipeRatioX && swipeRatioX < 1) {
                     self.setFrame(swipeRatioX < 0.05 ? 1 : -1);
                  }
               }
               
               touch = {
                  time: -1,
                  x: 0,
                  y: 0
               };
            });
         } else {
            // Normal click handler
            $canvas.on("click keypress", function(event) {
               // Only react on ENTER
               if (event.type === "keypress") {
                  if (event.keyCode !== 13) {
                     return;
                  }
               } else {
                  this.blur();
               }
               
               self.setFrame(1);
            });
         }

         if (settings.nextId) {
            $(settings.nextId).on("click keypress", function(event) {
               // Only react on ENTER
               if (event.type === "keypress") {
                  if (event.keyCode !== 13) {
                     return;
                  }
               } else {
                  this.blur();
               }
               
               self.setFrame(1);
            });
         }
         
         if (settings.prevId) {
            $(settings.prevId).on("click keypress", function(event) {
               // Only react on ENTER
               if (event.type === "keypress") {
                  if (event.keyCode !== 13) {
                     return;
                  }
               } else {
                  this.blur();
               }
               
               self.setFrame(-1);
            });
         }
         
         $positionMaximum.text(settings.frames.length);
         $canvas.appendTo($figure.appendTo($container));
         
         this.render = function() {
            self.setFrame();
         };
         
         return this;
      };
      
      return this.each(function() {
         var box = new SlideBox($(this));
         box.render();
         $(this).data("slidebox", box);
      });
   };
   
})(jQuery);